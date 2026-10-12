import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { SerpAPIService } from './serpApiService.ts';
import { config } from '../config.ts';
import { createGoogleShoppingTool } from '../tools/googleShoppingTool.ts';
import { createGoogleFlightsTool } from '../tools/googleFlightsTool.ts';
import { createGoogleHotelsTool } from '../tools/googleHotelsTool.ts';

export const getMCPTools = async () => {
  const mcpClient = new MultiServerMCPClient({
    filesystem: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    },
    // O MCP genérico da SerpApi (tool "search") foi removido de propósito:
    // com as 3 tools específicas abaixo, ter também uma "search" genérica faria o modelo
    // escolher entre duas formas de buscar a mesma coisa.
  });

  const mcpTools = await mcpClient.getTools();

  const serpAPIService = new SerpAPIService(config.serpAPIConfig);

  return [
    ...mcpTools,
    createGoogleShoppingTool(serpAPIService), // produtos / menor preço
    createGoogleFlightsTool(serpAPIService), // passagens aéreas
    createGoogleHotelsTool(serpAPIService), // hospedagem
  ];
};