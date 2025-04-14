import { z } from 'zod';

// Common schemas
const TokenSchema = z.object({
  text: z.string(),
  p: z.number(),
});

const SegmentSchema = z.object({
  id: z.number(),
  text: z.string(),
  start_ms: z.number(),
  end_ms: z.number(),
  speaker_turn: z.boolean(),
  confidence: z.number().optional(),
  tokens: z.array(TokenSchema).optional(),
});

const DeviceSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const ModelInfoSchema = z.object({
  name: z.string(),
  type: z.string(),
  multilingual: z.coerce.boolean(),
  vocab_size: z.number(),
  audio_ctx: z.number(),
  text_ctx: z.number(),
});

const ParamsSchema = z.object({
  n_threads: z.number(),
  step_ms: z.number(),
  length_ms: z.number(),
  keep_ms: z.number(),
  capture_id: z.number(),
  max_tokens: z.number(),
  audio_ctx: z.number(),
  beam_size: z.number(),
  vad_thold: z.number(),
  freq_thold: z.number(),
  translate: z.boolean(),
  no_fallback: z.boolean(),
  print_special: z.boolean(),
  no_context: z.boolean(),
  no_timestamps: z.boolean(),
  tinydiarize: z.boolean(),
  save_audio: z.boolean(),
  use_gpu: z.boolean(),
  flash_attn: z.boolean(),
  json_output: z.boolean(),
  print_tokens: z.boolean(),
  replay: z.boolean(),
  replay_file: z.string(),
  language: z.string(),
  model: z.string(),
  fname_out: z.string(),
  get_audio_devices: z.boolean(),
});

// Specific output schemas
const InitSchema = z.object({
  type: z.literal('init'),
  devices: z.array(DeviceSchema),
  model: ModelInfoSchema,
  params: ParamsSchema,
});

const ProcessingMetaSchema = z.object({
  type: z.literal('processing-meta'),
  samples: z.object({
    step: z.number(),
    step_sec: z.number(),
    length_sec: z.number(),
    keep_sec: z.number(),
  }),
  threads: z.number(),
  language: z.string(),
  task: z.enum(['translate', 'transcribe']),
  timestamps: z.boolean(),
  vad: z.boolean(),
  n_new_line: z.number().optional(),
  no_context: z.boolean().optional(),
});

const StdoutSchema = z.object({
  type: z.literal('stdout'),
  text: z.string(),
});

const StderrSchema = z.object({
  type: z.literal('stderr'),
  text: z.string(),
});

const ParamsOutputSchema = z.object({
  type: z.literal('params'),
  params: ParamsSchema,
});

const segmentFinalBaseSchema = z.object({
  iter: z.number(),
  iter_start_ms: z.number(),
  segments: z.array(SegmentSchema),
  text: z.string(),
});

const PredictionSchema = segmentFinalBaseSchema.extend({
  type: z.literal('prediction'),
});

const segmentFinalSchema = segmentFinalBaseSchema.extend({
  type: z.literal('segment_final'),
});

// Combined schema for all possible output types
export const WhisperStreamOutputSchema = z.discriminatedUnion('type', [
  InitSchema,
  ProcessingMetaSchema,
  StdoutSchema,
  StderrSchema,
  ParamsOutputSchema,
  PredictionSchema,
  segmentFinalSchema,
]);

// Define TypeScript types from schemas
export type TokenType = z.infer<typeof TokenSchema>;
export type SegmentType = z.infer<typeof SegmentSchema>;
export type DeviceType = z.infer<typeof DeviceSchema>;
export type ModelInfoType = z.infer<typeof ModelInfoSchema>;
export type ParamsType = z.infer<typeof ParamsSchema>;
export type InitType = z.infer<typeof InitSchema>;
export type ProcessingMetaType = z.infer<typeof ProcessingMetaSchema>;
export type StdoutType = z.infer<typeof StdoutSchema>;
export type StderrType = z.infer<typeof StderrSchema>;
export type ParamsOutputType = z.infer<typeof ParamsOutputSchema>;
export type PredictionType = z.infer<typeof PredictionSchema>;
export type segmentFinalType = z.infer<typeof segmentFinalSchema>;
export type WhisperStreamOutput = z.infer<typeof WhisperStreamOutputSchema>;

/**
 * Parse CLI output from stdout
 * @param data The data string from stdout
 * @returns Parsed output object
 */
export function parseStdout(data: string): WhisperStreamOutput {
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(data.trim());
    return WhisperStreamOutputSchema.parse(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('wrapping: ', data.trim().slice(0, 30));
    }
    // If not valid JSON, wrap as text
    return {
      text: data.trim(),
      type: 'stdout',
    };
  }
}

/**
 * Parse CLI output from stderr
 * @param data The data string from stderr
 * @returns Parsed output object
 */
export function parseStderr(data: string): WhisperStreamOutput {
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(data.trim());
    return WhisperStreamOutputSchema.parse(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('wrapping: ', data.trim().slice(0, 30));
    }
    // If not valid JSON, wrap as stderr text
    return {
      text: data.trim(),
      type: 'stderr',
    };
  }
}

/**
 * Helper function to check if an output is a specific type
 * @param output The output object
 * @param type The type to check for
 * @returns Whether the output is of the specified type
 */
export function isOutputType<T extends WhisperStreamOutput['type']>(
  output: WhisperStreamOutput,
  type: T,
): output is Extract<WhisperStreamOutput, { type: T }> {
  return output.type === type;
}

/**
 * Helper function to get all final segments from an array of outputs
 * @param outputs Array of parsed outputs
 * @returns Array of final segment objects
 */
export function getFinalSegments(outputs: WhisperStreamOutput[]): segmentFinalType[] {
  return outputs.filter((output): output is segmentFinalType => output.type === 'segment_final');
}

/**
 * Helper function to get all predictions from an array of outputs
 * @param outputs Array of parsed outputs
 * @returns Array of prediction objects
 */
export function getPredictions(outputs: WhisperStreamOutput[]): PredictionType[] {
  return outputs.filter((output): output is PredictionType => output.type === 'prediction');
}
