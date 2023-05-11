import { Injectable } from '@nestjs/common';
import { throws } from 'assert';
import {
  CreateCompletionRequest,
  CreateCompletionResponse,
  OpenAIApi,
} from 'openai';

import { ChatDto, ChatMessageDto } from './chat.dto';

@Injectable()
export class ChatService {
  constructor(private readonly openApiClient: OpenAIApi) {}

  // Request handling

  private mapChatDtoToPrompt(chatDto: ChatDto): string {
    const situationalContext = `You are a therapist. You are intelligent and witty. You are giving your client advice. Your conversation thus ar has been:`;
    const chatMessages: string[] = chatDto.messages.map(
      (message) => `${message.authorName}: "${message.content}`,
    );
    const inquiryToRespond =
      'Please respond, folliwng the same conversation format.';

    const languageModelPrompt = `
      ${situationalContext}\n
      ${chatMessages.join('\n')}\n
      ${inquiryToRespond}
    `;

    return languageModelPrompt;
  }

  private buildRequestFromChat = (
    chatDto: ChatDto,
  ): CreateCompletionRequest => {
    const prompt = this.mapChatDtoToPrompt(chatDto);
    const languageModelRequest: CreateCompletionRequest = {
      model: 'text-davinci-003',
      prompt: prompt,
      max_tokens: 500,
      temperature: 0.5,
    };

    return languageModelRequest;
  };

  // Response Handling

  private getNextMessageOrThrow = (response: CreateCompletionResponse) => {
    const languageModelResponse = response.choices[0].text;

    if (!languageModelResponse) {
      throw new Error('Cannot get chat dto from language model response');
    }

    return languageModelResponse;
  };

  private parseResponseIntoChatMessage = (
    languageModelResponse: string,
  ): ChatMessageDto => {
    const [authorNameRaw, messageInQuotes] = languageModelResponse.split(':');
    const authorName = authorNameRaw.trim().replaceAll('\n', '');
    const content = messageInQuotes.trim().replaceAll('"', '');

    return {
      authorName,
      content,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
  };

  private getChatDtoFromLanguageModelResponse(
    chatBeforeResponse: ChatDto,
    response: CreateCompletionResponse,
  ): ChatDto {
    const languageModelResponse = this.getNextMessageOrThrow(response);
    const responseAsMessage = this.parseResponseIntoChatMessage(
      languageModelResponse,
    );
    const chatDtoAfterResponse = chatBeforeResponse;
    chatDtoAfterResponse.messages.push(responseAsMessage);

    return chatDtoAfterResponse;
  }

  public async respondToChat(chatDto: ChatDto): Promise<ChatDto> {
    const languageModelRequest = this.buildRequestFromChat(chatDto);

    const languageModelResponse = await this.openApiClient.createCompletion(
      languageModelRequest,
    );

    return this.getChatDtoFromLanguageModelResponse(
      chatDto,
      languageModelResponse.data,
    );
  }
}
