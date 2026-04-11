<template>
  <main class="page">
    <h1 class="title">填写报名信息</h1>

    <VanForm @submit="submit">
      <VanCellGroup inset>
        <VanField
          v-model="name"
          name="name"
          label="姓名"
          placeholder="请输入姓名"
          maxlength="60"
          :rules="[{ required: true, message: '请填写姓名' }]"
        />
        <VanField
          v-model="school"
          name="school"
          label="学校"
          placeholder="请输入学校名称"
          maxlength="120"
          :rules="[{ required: true, message: '请填写学校' }]"
        />
      </VanCellGroup>

      <div class="submit-area">
        <VanButton block round type="primary" native-type="submit" :loading="loading">
          提交报名
        </VanButton>
      </div>
    </VanForm>

    <VanNoticeBar v-if="message" class="message" left-icon="volume-o" :text="message" />
  </main>
</template>

<script setup lang="ts">
import { buildFingerprintHash } from '../utils/fingerprint'
import {
  Button as VanButton,
  CellGroup as VanCellGroup,
  Field as VanField,
  Form as VanForm,
  NoticeBar as VanNoticeBar,
  showToast
} from 'vant'

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
    message.value = res.duplicate ? '该设备已参与过，已返回首页查看开奖状态。' : '报名成功，正在返回首页。'
    showToast(message.value)
    await navigateTo('/')
  } catch (error: unknown) {
    const e = error as { data?: { message?: string }; message?: string }
    message.value = e.data?.message || e.message || '提交失败'
    showToast(message.value)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page {
  max-width: 680px;
  margin: 24px auto;
  padding: 16px;
}

.title {
  margin-bottom: 16px;
}

.submit-area {
  margin: 20px 16px 0;
}

.message {
  margin: 16px;
}
</style>
