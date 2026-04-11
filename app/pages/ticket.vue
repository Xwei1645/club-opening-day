<template>
  <main class="page">
    <h1>我的门票</h1>
    <p v-if="loading">加载中...</p>
    <p v-else-if="message">{{ message }}</p>
    <template v-else-if="ticket">
      <p>票码：{{ ticket.ticketCode }}</p>
      <p>状态：{{ ticket.status }}</p>
      <p>有效期至：{{ formatTime(ticket.expiresAt) }}</p>
      <img :src="qrImage" alt="ticket qrcode" />
    </template>
  </main>
</template>

<script setup lang="ts">
import QRCode from 'qrcode'

type TicketData = {
  ticketCode: string
  qrPayload: string
  status: string
  expiresAt: string
}

const loading = ref(true)
const message = ref('')
const ticket = ref<TicketData | null>(null)
const qrImage = ref('')

function formatTime(input: string) {
  return new Date(input).toLocaleString()
}

onMounted(async () => {
  const fingerprintHash = localStorage.getItem('fingerprintHash') || ''
  if (!fingerprintHash) {
    message.value = '未检测到报名记录，请先报名。'
    loading.value = false
    return
  }

  try {
    const result = await $fetch<{ stage: string; ticket?: TicketData }>('/api/public/result', {
      query: { fingerprintHash }
    })

    if (result.stage !== 'win' || !result.ticket) {
      message.value = '当前没有可展示的门票。'
      loading.value = false
      return
    }

    ticket.value = result.ticket
    qrImage.value = await QRCode.toDataURL(result.ticket.qrPayload)
  } catch {
    message.value = '门票读取失败，请稍后重试。'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page {
  max-width: 720px;
  margin: 48px auto;
  padding: 16px;
}
img {
  width: 260px;
  max-width: 100%;
  border: 1px solid #ddd;
  border-radius: 8px;
}
</style>
