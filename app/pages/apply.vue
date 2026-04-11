<template>
  <main class="page">
    <h1>报名信息</h1>
    <form @submit.prevent="submit">
      <label>
        姓名
        <input v-model="name" required maxlength="60" />
      </label>
      <label>
        学校
        <input v-model="school" required maxlength="120" />
      </label>
      <button :disabled="loading" type="submit">{{ loading ? '提交中...' : '提交报名' }}</button>
    </form>
    <p v-if="message">{{ message }}</p>
  </main>
</template>

<script setup lang="ts">
import { buildFingerprintHash } from '../utils/fingerprint'

const name = ref('')
const school = ref('')
const loading = ref(false)
const message = ref('')

onMounted(() => {
  if (localStorage.getItem('agreementAccepted') !== '1') {
    navigateTo('/agreement')
  }
})

async function submit() {
  loading.value = true
  message.value = ''
  try {
    const fingerprintHash = await buildFingerprintHash()
    localStorage.setItem('fingerprintHash', fingerprintHash)
    const res = await $fetch<{ ok: boolean; duplicate: boolean }>('/api/public/apply', {
      method: 'POST',
      body: {
        name: name.value,
        school: school.value,
        fingerprintHash
      }
    })
    message.value = res.duplicate ? '该设备已参与过，已为你跳转等待页。' : '报名成功，正在跳转。'
    await navigateTo('/waiting')
  } catch (error: unknown) {
    const e = error as { data?: { message?: string }; message?: string }
    message.value = e.data?.message || e.message || '提交失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page {
  max-width: 720px;
  margin: 48px auto;
  padding: 16px;
}
form {
  display: grid;
  gap: 12px;
}
label {
  display: grid;
  gap: 6px;
}
</style>
