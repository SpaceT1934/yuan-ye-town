import clsx from 'clsx';
import { useMutation, useQuery } from 'convex/react';
import { KeyboardEvent, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useSendInput } from '../hooks/sendInput';
import { Player } from '../../convex/aiTown/player';
import { Conversation } from '../../convex/aiTown/conversation';
import { toastOnError } from '../toasts';

function createMessageUuid() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

export function MessageInput({
  worldId,
  engineId,
  humanPlayer,
  conversation,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  humanPlayer: Player;
  conversation: Conversation;
}) {
  const descriptions = useQuery(api.world.gameDescriptions, { worldId });
  const humanName = descriptions?.playerDescriptions.find((p) => p.playerId === humanPlayer.id)
    ?.name;
  const [text, setText] = useState('');
  const typingUuid = useRef<string | undefined>();
  const writeMessage = useMutation(api.messages.writeMessage);
  const startTyping = useSendInput(engineId, 'startTyping');
  const currentlyTyping = conversation.isTyping;

  const markAsTyping = async () => {
    if (currentlyTyping || typingUuid.current) {
      return;
    }
    const messageUuid = createMessageUuid();
    typingUuid.current = messageUuid;
    try {
      await startTyping({
        playerId: humanPlayer.id,
        conversationId: conversation.id,
        messageUuid,
      });
    } catch (error) {
      typingUuid.current = undefined;
      console.error('Unable to set typing status', error);
    }
  };

  const sendMessage = async () => {
    const message = text.trim();
    if (!message) {
      return;
    }
    let messageUuid = typingUuid.current;
    if (currentlyTyping && currentlyTyping.playerId === humanPlayer.id) {
      messageUuid = currentlyTyping.messageUuid;
    }
    messageUuid = messageUuid || createMessageUuid();
    await toastOnError(
      writeMessage({
        worldId,
        playerId: humanPlayer.id,
        conversationId: conversation.id,
        text: message,
        messageUuid,
      }),
    );
    typingUuid.current = undefined;
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="leading-tight mb-6">
      <div className="flex gap-4">
        <span className="uppercase flex-grow">{humanName}</span>
      </div>
      <div className={clsx('bubble', 'bubble-mine', 'flex', 'items-end', 'gap-2')}>
        <textarea
          className="bg-white -mx-3 -my-1 flex-1 resize-none text-black p-1"
          value={text}
          rows={2}
          placeholder="在这里输入，按回车发送"
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) {
              void markAsTyping();
            }
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="bg-clay-700 px-3 py-1 text-white disabled:opacity-50"
          disabled={!text.trim()}
          onClick={() => void sendMessage()}
        >
          发送
        </button>
      </div>
    </div>
  );
}
