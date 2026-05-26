export function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Selamat pagi';
  if (hour >= 12 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 19) return 'Selamat sore';
  return 'Selamat malam';
}

export function getInitials(username) {
  if (!username) return '?';
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

export function getDashboardSubtitle(username) {
  const name = username || 'Pengguna';
  return `Have a great day, ${name}! Buat kamu yang lagi memperjuangkan mimpi dan rencana, teruslah berjuang dan jangan menyerah. Yuk, mulai atur keuangan mu sekarang juga!`;
}
