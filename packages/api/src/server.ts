import Fastify, { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { runIsomorph } from '@isomorph/core';
import {
  AnalyzeRequestSchema,
  AnalyzeResponse,
  HealthResponse,
  ErrorResponse,
} from './types';

/**
 * Loads the canonical demo scenario files from the demo/ directory.
 */
function getDemoScenarioFiles(scenarioName: string): { before: string; after: string } {
  const norm = scenarioName.toLowerCase().trim().replace(/\s+/g, '_');
  let fileBase = `${norm}.js`;

  if (['discount', '01', '1', 'refactor_noise', 'refactor-noise'].includes(norm)) {
    fileBase = 'discount.js';
  } else if (['bounds', '02', '2', 'tiny_mutation', 'tiny-mutation', 'tiny_logic_mutation', 'tiny-logic-mutation'].includes(norm)) {
    fileBase = 'bounds.js';
  } else if (['auth', '03', '3', 'auth_risk', 'auth-risk', 'authentication_risk', 'authentication-risk'].includes(norm)) {
    fileBase = 'auth.js';
  }

  const candidatesBefore = [
    path.resolve(__dirname, `../../../demo/before/${fileBase}`),
    path.resolve(process.cwd(), `demo/before/${fileBase}`),
  ];
  const candidatesAfter = [
    path.resolve(__dirname, `../../../demo/after/${fileBase}`),
    path.resolve(process.cwd(), `demo/after/${fileBase}`),
  ];

  const beforeFile = candidatesBefore.find((f) => fs.existsSync(f));
  const afterFile = candidatesAfter.find((f) => fs.existsSync(f));

  if (!beforeFile || !afterFile) {
    throw new Error(`Demo scenario '${scenarioName}' was not found on disk.`);
  }

  return {
    before: fs.readFileSync(beforeFile, 'utf-8'),
    after: fs.readFileSync(afterFile, 'utf-8'),
  };
}

/**
 * Builds and configures the Fastify HTTP API server.
 */
export function buildServer(options: { logger?: boolean } = { logger: false }): FastifyInstance {
  const fastify = Fastify({ logger: options.logger });

  // Enable CORS for web clients
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });

  // GET /health — Liveness probe and service metadata
  fastify.get('/health', async (_req, reply) => {
    const health: HealthResponse = {
      status: 'ok',
      service: 'isomorph-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
    return reply.code(200).send(health);
  });

  // POST /api/analyze — Main deterministic verification endpoint
  fastify.post('/api/analyze', async (request, reply) => {
    // 1. Zod request validation
    const parsed = AnalyzeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const errResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Request payload failed schema validation.',
        statusCode: 400,
        details: parsed.error.flatten(),
      };
      return reply.code(400).send(errResponse);
    }

    const {
      beforeSource,
      afterSource,
      before,
      after,
      scenario,
      demoScenario,
      options: runOpts,
    } = parsed.data;

    let finalBefore = beforeSource || before;
    let finalAfter = afterSource || after;

    const requestedScenario = scenario || demoScenario;

    // 2. Resolve optional demo scenario if sources are not directly provided
    if ((!finalBefore || !finalAfter) && requestedScenario) {
      try {
        const scenarioFiles = getDemoScenarioFiles(requestedScenario);
        finalBefore = finalBefore || scenarioFiles.before;
        finalAfter = finalAfter || scenarioFiles.after;
      } catch (scenarioErr) {
        const err = scenarioErr as Error;
        const errResponse: ErrorResponse = {
          error: 'ScenarioNotFoundError',
          message: err.message,
          statusCode: 404,
        };
        return reply.code(404).send(errResponse);
      }
    }

    if (!finalBefore || !finalAfter) {
      const errResponse: ErrorResponse = {
        error: 'InvalidSourceInput',
        message: 'Both beforeSource and afterSource must be provided as non-empty strings.',
        statusCode: 400,
      };
      return reply.code(400).send(errResponse);
    }

    // 3. Execute existing Isomorph deterministic verification pipeline
    try {
      const result = await runIsomorph(finalBefore, finalAfter, runOpts);

      const response: AnalyzeResponse = {
        structuralAnalysis: result.analysis.structuralDiff,
        riskAnalysis: {
          riskMap: result.analysis.riskMap,
          riskSummary: result.analysis.riskSummary,
        },
        bobAnnotations: result.annotations,
        behavioralEvidence: result.evidenceRecord,
        changeProof: result.changeProof,

        // Preserved compatibility fields
        analysis: result.analysis,
        annotations: result.annotations,
        evidenceRecord: result.evidenceRecord,
      };

      return reply.code(200).send(response);
    } catch (e) {
      const err = e as Error;
      fastify.log.error(err);
      const errResponse: ErrorResponse = {
        error: err.name || 'PipelineExecutionError',
        message: err.message || 'An error occurred during verification pipeline execution.',
        statusCode: 500,
      };
      return reply.code(500).send(errResponse);
    }
  });

  return fastify;
}

export const app = buildServer({ logger: true });

if (require.main === module) {
  const start = async () => {
    try {
      const port = Number(process.env.PORT) || 3000;
      const host = process.env.HOST || '0.0.0.0';
      await app.listen({ port, host });
      app.log.info(`ISOMORPH API Server listening on http://${host}:${port}`);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  start();
}
