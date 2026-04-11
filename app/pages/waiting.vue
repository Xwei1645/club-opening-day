<template>
  <main class="page">
    <h1>开奖状态</h1>
    <p v-if="!fingerprintHash">未检测到报名设备，请先报名。</p>
    <p v-else>{{ statusText }}</p>
    <NuxtLink v-if="fingerprintHash" to="/ticket">去查看门票页</NuxtLink>
  </main>
</template>

<script setup lang="ts">
const fingerprintHash = ref('')
const statusText = ref('正在读取状态...')
let timer: ReturnType<typeof setInterval> | null = null

async function refresh() {
  if (!fingerprintHash.value) {
    return
  }
  try {
    const res = await $fetch<{ stage: string }>('/api/public/result', {
      query: { fingerprintHash: fingerprintHash.value }
    })

    if (res.stage === 'waiting') {
      statusText.value = '尚未开奖，请耐心等待。'
    } else if (res.stage === 'hidden') {
      statusText.value = '结果已生成，等待管理员公布。'
    } else if (res.stage === 'win') {
      statusText.value = '恭喜中奖，正在跳转门票页。'
      await navigateTo('/ticket')
    } else if (res.stage === 'lose') {
      statusText.value = '很遗憾，本次未中奖。'
    }
  } catch {
    statusText.value = '状态读取失败，请稍后刷新。'
  }
}

onMounted(async () => {
  fingerprintHash.value = localStorage.getItem('fingerprintHash') || ''
  await refresh()
  timer = setInterval(refresh, 10000)
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style scoped>
.page {
  max-width: 720px;
  margin: 48px auto;
  padding: 16px;
}
</style>
