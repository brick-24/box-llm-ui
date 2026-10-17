import { IProviderAdapter } from './provider-interface';
import { OpenAiAdapter } from './openai-adapter';
import { ResponsesAdapter } from './responses-adapter';
import { CustomJsonAdapter } from './custom-json-adapter';
import { ApiProtocol } from '../../shared/types';

export class AdapterFactory {
  private static openAiAdapter = new OpenAiAdapter();
  private static responsesAdapter = new ResponsesAdapter();
  private static customJsonAdapter = new CustomJsonAdapter();

  public static getAdapter(protocol: ApiProtocol): IProviderAdapter {
    switch (protocol) {
      case 'openai-chat':
        return this.openAiAdapter;
      case 'openai-responses':
        return this.responsesAdapter;
      case 'custom-json':
        return this.customJsonAdapter;
      default:
        return this.openAiAdapter;
    }
  }
}
