import request from 'supertest';
import { buildServer } from '../src/server';

describe('ISOMORPH HTTP API (P1.1)', () => {
  const app = buildServer({ logger: false });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('returns 200 with service metadata and status ok', async () => {
      const res = await request(app.server).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('isomorph-api');
      expect(res.body.version).toBe('1.0.0');
      expect(typeof res.body.timestamp).toBe('string');
    });
  });

  describe('POST /api/analyze', () => {
    it('validates request via Zod and returns all 5 layers of existing Isomorph result', async () => {
      const beforeSource = `
        function calculateDiscount(price, rate) {
          return price > 0 ? price * (1 - rate) : 0;
        }
      `;
      const afterSource = `
        function calculateDiscount(price, rate) {
          return price * (1 - rate);
        }
      `;

      const res = await request(app.server)
        .post('/api/analyze')
        .send({
          beforeSource,
          afterSource,
          options: { skipEvidence: true },
        });

      expect(res.status).toBe(200);

      // Verify required response elements per P1.1 spec:
      // 1. Structural Analysis
      expect(res.body.structuralAnalysis).toBeDefined();
      expect(Array.isArray(res.body.structuralAnalysis.nodes)).toBe(true);
      expect(res.body.structuralAnalysis.summary).toBeDefined();

      // 2. Risk Analysis
      expect(res.body.riskAnalysis).toBeDefined();
      expect(Array.isArray(res.body.riskAnalysis.riskMap)).toBe(true);
      expect(res.body.riskAnalysis.riskSummary).toBeDefined();

      // 3. Bob Annotations
      expect(res.body.bobAnnotations).toBeDefined();
      expect(Array.isArray(res.body.bobAnnotations)).toBe(true);

      // 4. Behavioral Evidence
      expect(res.body.behavioralEvidence).toBeNull(); // Skipped per option

      // 5. Change Proof
      expect(res.body.changeProof).toBeDefined();
      expect(res.body.changeProof.proofVersion).toBe('1.0');
      expect(typeof res.body.changeProof.proofHash).toBe('string');
      expect(res.body.changeProof.proofHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('accepts demo scenario shorthand and resolves demo corpus files', async () => {
      const res = await request(app.server)
        .post('/api/analyze')
        .send({
          scenario: 'discount',
          options: { skipEvidence: true },
        });

      expect(res.status).toBe(200);
      expect(res.body.changeProof).toBeDefined();
      expect(res.body.changeProof.proofHash).toBeDefined();
      expect(res.body.riskAnalysis.riskSummary.high).toBeGreaterThan(0);
    });

    it('Scenario 01 (Refactor Noise): resolves refactor_noise fixture and flags logic mutation', async () => {
      const res = await request(app.server)
        .post('/api/analyze')
        .send({
          scenario: 'refactor_noise',
          options: { skipEvidence: true },
        });

      expect(res.status).toBe(200);
      expect(res.body.riskAnalysis.riskSummary.high).toBeGreaterThanOrEqual(1);
      expect(res.body.changeProof.proofHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('Scenario 02 (Tiny Logic Mutation): resolves tiny_mutation fixture and flags off-by-one bounds flaw', async () => {
      const res = await request(app.server)
        .post('/api/analyze')
        .send({
          scenario: 'tiny_mutation',
          options: { skipEvidence: true },
        });

      expect(res.status).toBe(200);
      // Even with only 3 lines changed, flags high risk condition mutation
      expect(res.body.riskAnalysis.riskSummary.high).toBeGreaterThanOrEqual(1);
      expect(res.body.changeProof.proofHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('Scenario 03 (Authentication Risk): resolves auth_risk fixture and demonstrates full verification', async () => {
      const res = await request(app.server)
        .post('/api/analyze')
        .send({
          scenario: 'auth_risk',
        });

      expect(res.status).toBe(200);
      // Flags security bypass and loosened permission checks
      expect(res.body.riskAnalysis.riskSummary.high).toBeGreaterThanOrEqual(2);
      expect(res.body.behavioralEvidence).toBeDefined();
      expect(res.body.changeProof.proofHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('returns 400 Bad Request with explicit error when schema validation fails', async () => {
      const res = await request(app.server)
        .post('/api/analyze')
        .send({
          invalidKey: 'test',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
      expect(res.body.statusCode).toBe(400);
      expect(res.body.details).toBeDefined();
    });

    it('returns 404 with explicit error when demo scenario is not found', async () => {
      const res = await request(app.server)
        .post('/api/analyze')
        .send({
          scenario: 'nonexistent-scenario-xyz',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('ScenarioNotFoundError');
      expect(res.body.message).toContain('nonexistent-scenario-xyz');
    });
  });
});
