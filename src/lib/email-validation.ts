export function emailValidationMessage(raw: string): string {
  const email = raw.trim()
  if (!email) return '请输入接收验证码的邮箱，例如 name@qq.com'
  if (/[＠。．，]/.test(email)) return '请使用英文半角 @ 和句点 .，例如 name@qq.com'
  if (/\s/.test(email)) return '邮箱中间不能有空格，请检查后重试'
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不正确，请填写完整地址，例如 name@qq.com'
  return ''
}
