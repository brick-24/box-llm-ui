import { AppSettings, ToolCallItem, WebCitation } from '../../../shared/types';
import { executeWebTool, ToolExecutionOutput } from '../../browser/web-tools';
import { executeFileTool } from './file-tools';
import { executePdfTool } from './pdf-tools';

export async function executeAnyTool(
  toolName: string,
  args: Record<string, any>,
  settings?: AppSettings
): Promise<ToolExecutionOutput> {
  // 1. Web tools
  if (['search_web', 'fetch_web_page', 'browse_page', 'take_page_screenshot'].includes(toolName)) {
    return executeWebTool(toolName, args, settings);
  }

  // 2. File tools
  if (['create_file', 'read_file'].includes(toolName)) {
    const res = await executeFileTool(toolName, args);
    return {
      result: res.result,
    };
  }

  // 3. PDF tools
  if (['generate_pdf'].includes(toolName)) {
    const res = await executePdfTool(toolName, args);
    return {
      result: res.result,
    };
  }

  throw new Error(`Unknown tool: ${toolName}`);
}
