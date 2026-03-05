import { useRef } from 'react';
import { Users, Upload, X, UserCheck } from 'lucide-react';
import { getDefaultAvatar } from '@/lib/parser';
import type { ChatUser } from '@/types';

interface UserAvatarManagerProps {
  users: ChatUser[];
  selfId: number | null;
  onUpdateAvatar: (userId: number, avatar: string) => void;
  onRemoveAvatar: (userId: number) => void;
  onSetSelf: (userId: number) => void;
}

function AvatarCard({ user, index, isSelf, onUpdateAvatar, onRemoveAvatar, onSetSelf }: {
  user: ChatUser;
  index: number;
  isSelf: boolean;
  onUpdateAvatar: (userId: number, avatar: string) => void;
  onRemoveAvatar: (userId: number) => void;
  onSetSelf: (userId: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarSrc = user.avatar || getDefaultAvatar(index);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUpdateAvatar(user.id, ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="avatar-card">
      <div className="avatar-img-wrap">
        <img src={avatarSrc} alt={user.name} />
        <div className="avatar-overlay" onClick={() => fileRef.current?.click()}>
          <Upload size={20} color="#fff" />
        </div>
        {user.avatar && (
          <button className="avatar-remove" onClick={() => onRemoveAvatar(user.id)}>
            <X size={12} />
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} />
      </div>
      <span className="avatar-name">{user.name}</span>
      {isSelf
        ? <span className="avatar-tag">自己</span>
        : <button className="avatar-set-self" onClick={() => onSetSelf(user.id)}><UserCheck size={12} /> 设为自己</button>
      }
    </div>
  );
}

export function UserAvatarManager({ users, selfId, onUpdateAvatar, onRemoveAvatar, onSetSelf }: UserAvatarManagerProps) {
  if (users.length === 0) return null;

  return (
    <div className="s-card">
      <div className="s-card-header">
        <h2><Users size={20} /> 用户头像管理</h2>
        <span className="s-card-badge">{users.length} 个用户</span>
      </div>
      <div className="s-card-body">
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>鼠标悬停头像可上传自定义图片</p>
        <div className="avatar-grid">
          {users.map((user, index) => (
            <AvatarCard
              key={user.id}
              user={user}
              index={index}
              isSelf={user.id === selfId}
              onUpdateAvatar={onUpdateAvatar}
              onRemoveAvatar={onRemoveAvatar}
              onSetSelf={onSetSelf}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
