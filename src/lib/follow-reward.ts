export const followRewardKeyword = '微信工具箱额度'

export async function copyFollowRewardKeyword(clipboard: Pick<Clipboard, 'writeText'>) {
  await clipboard.writeText(followRewardKeyword)
}
