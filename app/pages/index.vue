<template>
  <main class="page">
    <h1 class="title">开业日门票抽奖</h1>

    <VanCard class="draw-card" title="抽奖状态" desc="提交后将自动进入开奖等待，开奖后二维码会展示在此处。">
      <template #tags>
        <VanTag :type="statusTagType" plain>{{ statusLabel }}</VanTag>
      </template>

      <template #footer>
        <VanButton
          v-if="!fingerprintHash"
          type="primary"
          block
          round
          @click="openAgreement"
        >
          参与抽奖
        </VanButton>
      </template>

      <div v-if="fingerprintHash" class="result-area">
        <VanLoading v-if="loadingResult" size="20px">读取开奖状态中...</VanLoading>
        <p v-else class="result-text">{{ statusText }}</p>

        <div v-if="ticket && qrImage" class="ticket-panel">
          <p>票码：{{ ticket.ticketCode }}</p>
          <p>状态：{{ ticket.status }}</p>
          <p>有效期至：{{ formatTime(ticket.expiresAt) }}</p>
          <img class="qr-image" :src="qrImage" alt="ticket qrcode" />
        </div>
      </div>
    </VanCard>

    <VanPopup v-model:show="showAgreement" round position="bottom" :style="{ height: '72%' }">
      <section class="agreement">
        <h2>参与协议</h2>
        <p>1. 每个设备仅可参与一次。</p>
        <p>2. 提交信息后请等待开奖。</p>
        <p>3. 中奖后请在有效期内核销门票。</p>

        <VanCheckbox v-model="agreed" class="agree-line">我已阅读并同意协议</VanCheckbox>

        <VanButton
          type="primary"
          block
          round
          :disabled="!canConfirmAgreement"
          @click="confirmAgreement"
        >
          {{ confirmButtonText }}
        </VanButton>
      </section>
    </VanPopup>
  </main>
</template>

<script setup lang="ts">
import QRCode from 'qrcode'
import {
  Button as VanButton,
  Card as VanCard,
  Checkbox as VanCheckbox,
  Loading as VanLoading,
  Popup as VanPopup,
  Tag as VanTag
} from 'vant'

type TicketData = {
  ticketCode: string
  qrPayload: string
  status: string
  expiresAt: string
}

const showAgreement = ref(false)
const agreed = ref(false)
const confirmCountdown = ref(5)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const fingerprintHash = ref('')
const loadingResult = ref(false)
const statusText = ref('提交报名后可在此查看开奖结果。')
const stage = ref<'idle' | 'waiting' | 'hidden' | 'win' | 'lose'>('idle')
const ticket = ref<TicketData | null>(null)
const qrImage = ref('')
let resultTimer: ReturnType<typeof setInterval> | null = null

const canConfirmAgreement = computed(() => agreed.value && confirmCountdown.value <= 0)
const confirmButtonText = computed(() => {
  if (confirmCountdown.value > 0) {
    return `请阅读协议（${confirmCountdown.value}s）`
  }
  return '同意并填写报名表'
})

const statusLabel = computed(() => {
  if (!fingerprintHash.value) {
    return '未报名'
  }
  if (stage.value === 'win') {
    return '已中奖'
  }
  if (stage.value === 'lose') {
    return '未中奖'
  }
  return '等待开奖'
})

const statusTagType = computed(() => {
  if (stage.value === 'win') {
    return 'success'
  }
  if (stage.value === 'lose') {
    return 'danger'
  }
  return 'warning'
})

function formatTime(input: string) {
  return new Date(input).toLocaleString()
}

function openAgreement() {
  showAgreement.value = true
}

function resetAgreementState() {
  agreed.value = false
  confirmCountdown.value = 5
}

async function confirmAgreement() {
  if (!canConfirmAgreement.value) {
    return
  }
  localStorage.setItem('agreementAccepted', '1')
  showAgreement.value = false
  await navigateTo('/apply')
}

async function refreshResult() {
  if (!fingerprintHash.value) {
    return
  }

  loadingResult.value = true
  try {
    const res = await $fetch<{ stage: string; ticket?: TicketData }>('/api/public/result', {
      query: { fingerprintHash: fingerprintHash.value }
    })

    stage.value = (res.stage as 'waiting' | 'hidden' | 'win' | 'lose') || 'waiting'
    if (res.stage === 'win' && res.ticket) {
      ticket.value = res.ticket
      qrImage.value = await QRCode.toDataURL(res.ticket.qrPayload)
      statusText.value = '恭喜中奖，二维码已生成。'
      if (resultTimer) {
        clearInterval(resultTimer)
        resultTimer = null
      }
      return
    }

    ticket.value = null
    qrImage.value = ''
    if (res.stage === 'lose') {
      statusText.value = '很遗憾，本次未中奖。'
      if (resultTimer) {
        clearInterval(resultTimer)
        resultTimer = null
      }
    } else {
      statusText.value = '等待开奖中，请稍后自动刷新。'
    }
  } catch {
    statusText.value = '状态读取失败，请稍后重试。'
  } finally {
    loadingResult.value = false
  }
}

watch(showAgreement, (visible) => {
  if (visible) {
    resetAgreementState()
    countdownTimer = setInterval(() => {
      if (confirmCountdown.value > 0) {
        confirmCountdown.value -= 1
      }
    }, 1000)
    return
  }

  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})

onMounted(async () => {
  fingerprintHash.value = localStorage.getItem('fingerprintHash') || ''
  if (!fingerprintHash.value) {
    return
  }

  await refreshResult()
  resultTimer = setInterval(refreshResult, 10000)
})

onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
  if (resultTimer) {
    clearInterval(resultTimer)
  }
})
</script>

<style scoped>
.page {
  max-width: 680px;
  margin: 24px auto;
  padding: 16px;
}

.title {
  margin-bottom: 16px;
  font-size: 24px;
}

.draw-card {
  overflow: hidden;
}

.result-area {
  margin-top: 14px;
}

.result-text {
  margin: 0;
  color: #555;
}

.ticket-panel {
  margin-top: 12px;
  padding: 12px;
  border-radius: 10px;
  background: #f7f8fa;
}

.ticket-panel p {
  margin: 4px 0;
}

.qr-image {
  margin-top: 8px;
  width: 220px;
  max-width: 100%;
  border-radius: 8px;
  background: #fff;
}

.agreement {
  padding: 20px 16px;
}

.agreement h2 {
  margin: 0 0 12px;
}

.agreement p {
  margin: 8px 0;
  color: #444;
}

.agree-line {
  margin: 18px 0;
}
</style>
