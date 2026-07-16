import { generateAgentPlanImage, AGENT_PLAN_IMAGE_SIZES } from '../agent-plan/image';
import {
  AGENT_PLAN_VIDEO_MODELS,
  createAgentPlanVideoTask,
  getAgentPlanVideoTask,
  waitForAgentPlanVideoTask,
} from '../agent-plan/video';

function formatError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Agent Plan image generation failed.';
  const code = 'code' in error ? String(error.code) : '';
  if (code === 'not-configured' || code === 'unauthorized') {
    return '火山引擎 Agent Plan 尚未验证或凭据已失效，请在模型供应商设置中重新验证。';
  }
  if (code === 'rate-limited') return 'Agent Plan 当前请求较多，请稍后重试。';
  if (code === 'invalid-input') return error instanceof Error ? error.message : '图片生成参数无效。';
  return '图片生成暂时失败，请稍后重试。';
}

export async function createAgentPlanMediaServer() {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk');
  const { z } = await import('zod/v4');

  return createSdkMcpServer({
    name: 'agent-plan-media',
    version: '1.0.0',
    tools: [
      tool(
        'generate_image',
        `Generate a new image with Volcengine Agent Plan Seedream 5.0 lite.

Use this tool whenever the user asks to create, draw, design, render, or generate an image. This is a dedicated image-generation model; do not try to use the current chat model for image generation.

Write a detailed prompt that preserves the user's language, requested text, composition, style, color, lighting, and aspect intent. The generated image is returned as a first-class attachment in the conversation.`,
        {
          prompt: z.string().min(1).max(8_000).describe('Detailed image-generation prompt.'),
          size: z.enum(AGENT_PLAN_IMAGE_SIZES).optional().describe('Output quality. Defaults to 2K; use 3K or 4K only when the user needs higher resolution.'),
          watermark: z.boolean().optional().describe('Whether to add the provider watermark. Defaults to false.'),
        },
        async args => {
          try {
            const result = await generateAgentPlanImage(args);
            const lines = [
              '图片已生成。',
              `model: ${result.model}`,
              `size: ${args.size ?? '2K'}`,
              `prompt: ${args.prompt.slice(0, 1_000)}`,
              ...result.images.map((image, index) => `imageUrl${index + 1}: ${image.url}`),
            ];
            return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
          } catch (error) {
            return {
              content: [{ type: 'text' as const, text: `Error: ${formatError(error)}` }],
              isError: true,
            };
          }
        },
      ),
      tool(
        'generate_video',
        `Generate a video with Volcengine Agent Plan Seedance.

Use this tool whenever the user asks to create, render, animate, extend, or generate a video. Video generation is asynchronous: this tool creates a durable upstream task, waits for completion when possible, and returns a first-class playable video attachment. If it reports that the task is still running, use get_video_task with the returned taskId later; never submit the same request again merely because generation is slow.`,
        {
          prompt: z.string().min(1).max(8_000).describe('Detailed video prompt including subject, action, camera movement, scene, style, and timing.'),
          model: z.enum(AGENT_PLAN_VIDEO_MODELS).optional().describe('Seedance model. Defaults to doubao-seedance-2.0; fast prioritizes speed; mini prioritizes cost.'),
          referenceImageUrls: z.array(z.string().url()).max(4).optional().describe('Optional HTTPS reference images for image-to-video or visual consistency.'),
          ratio: z.enum(['adaptive', '16:9', '9:16', '1:1']).optional().describe('Video aspect ratio.'),
          duration: z.union([z.literal(5), z.literal(10)]).optional().describe('Video duration in seconds.'),
          resolution: z.enum(['720p', '1080p']).optional().describe('Output resolution.'),
          generateAudio: z.boolean().optional().describe('Generate synchronized audio when supported. Defaults to true.'),
        },
        async args => {
          let createdTaskId = '';
          try {
            const created = await createAgentPlanVideoTask(args);
            createdTaskId = created.id;
            const task = await waitForAgentPlanVideoTask(created.id);
            if (task.status === 'succeeded' && task.videoUrl) {
              return {
                content: [{ type: 'text' as const, text: [
                  '视频已生成。',
                  `taskId: ${task.id}`,
                  `status: ${task.status}`,
                  `model: ${task.model}`,
                  `prompt: ${args.prompt.slice(0, 1_000)}`,
                  `videoUrl: ${task.videoUrl}`,
                  ...(task.resolution ? [`resolution: ${task.resolution}`] : []),
                  ...(task.ratio ? [`ratio: ${task.ratio}`] : []),
                  ...(task.duration ? [`duration: ${task.duration}`] : []),
                ].join('\n') }],
              };
            }
            return {
              content: [{ type: 'text' as const, text: [
                task.status === 'failed' ? 'Error: 视频生成失败。' : '视频任务已结束。',
                `taskId: ${task.id}`,
                `status: ${task.status}`,
                ...(task.errorCode ? [`errorCode: ${task.errorCode}`] : []),
              ].join('\n') }],
              isError: task.status === 'failed' || task.status === 'cancelled',
            };
          } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'timeout') {
              return {
              content: [{ type: 'text' as const, text: [
                '视频仍在生成中。任务已经持久化，请稍后使用 get_video_task 查询，不要重复创建。',
                ...(createdTaskId ? [`taskId: ${createdTaskId}`] : []),
                'status: running',
              ].join('\n') }],
              };
            }
            return { content: [{ type: 'text' as const, text: `Error: ${formatError(error)}` }], isError: true };
          }
        },
      ),
      tool(
        'get_video_task',
        'Query a previously created Agent Plan Seedance video task. Use the taskId returned by generate_video. When the task succeeds, this returns the playable video attachment.',
        { taskId: z.string().min(1).max(220).describe('Agent Plan video task ID returned by generate_video.') },
        async ({ taskId }) => {
          try {
            const task = await getAgentPlanVideoTask(taskId);
            return {
              content: [{ type: 'text' as const, text: [
                task.status === 'succeeded' ? '视频已生成。' : '视频任务状态已更新。',
                `taskId: ${task.id}`,
                `status: ${task.status}`,
                `model: ${task.model}`,
                ...(task.videoUrl ? [`videoUrl: ${task.videoUrl}`] : []),
                ...(task.errorCode ? [`errorCode: ${task.errorCode}`] : []),
              ].join('\n') }],
              isError: task.status === 'failed' || task.status === 'cancelled',
            };
          } catch (error) {
            return { content: [{ type: 'text' as const, text: `Error: ${formatError(error)}` }], isError: true };
          }
        },
      ),
    ],
  });
}
