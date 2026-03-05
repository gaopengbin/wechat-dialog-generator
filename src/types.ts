export interface ChatUser {
  id: number;
  name: string;
  avatar: string | null;
}

export type MessageType = 'text' | 'time' | 'image' | 'voice' | 'redpacket' | 'transfer';

export interface ChatMessage {
  id: number;
  type: MessageType;
  senderId: number;
  content: string;
  params: {
    duration?: number;
    amount?: string;
    remark?: string;
  };
}

export interface PhoneSettings {
  time: string;
  signal: number;
  battery: number;
  contactName: string;
  unreadCount: number;
  selfBubbleColor: string;
  otherBubbleColor: string;
}
