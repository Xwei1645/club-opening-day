<template>
  <main class="page">
    <h1>管理员后台</h1>
    <p>使用管理员 Token 访问后台接口。</p>

    <section>
      <label>
        Admin Token
        <input v-model="token" type="password" />
      </label>
      <button @click="saveToken">保存 Token</button>
    </section>

    <section>
      <h2>开奖配置</h2>
      <label>
        开奖时间
        <input v-model="drawAt" type="datetime-local" />
      </label>
      <label>
        门票过期时间
        <input v-model="ticketExpireAt" type="datetime-local" />
      </label>
      <label>
        中签人数
        <input v-model.number="winnerCount" type="number" min="1" />
      </label>
      <button @click="loadConfig">读取配置</button>
      <button @click="saveConfig">保存配置</button>
      <button @click="publishResults">公布结果</button>
      <p>{{ status }}</p>
    </section>

    <section>
      <h2>报名名单</h2>
      <button @click="loadParticipants">刷新名单</button>
      <table>
        <thead>
          <tr>
            <th>姓名</th>
            <th>学校</th>
            <th>结果</th>
            <th>票码</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in participants" :key="p.id">
            <td>{{ p.name }}</td>
            <td>{{ p.school }}</td>
            <td>{{ p.drawResult }}</td>
            <td>{{ p.ticket?.ticketCode || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>扫码核销</h2>
      <label>
        票码
        <input v-model="verifyCode" />
      </label>
      <button @click="verifyTicket">核销</button>
      <p>{{ verifyStatus }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
type DrawConfig = {
  drawAt: string
  ticketExpireAt: string
  winnerCount: number
}

type Participant = {
  id: string
  name: string
  school: string
  drawResult: string
  ticket?: { ticketCode: string }
}

const token = ref('')
const drawAt = ref('')
const ticketExpireAt = ref('')
const winnerCount = ref(100)
const status = ref('')
const participants = ref<Participant[]>([])
const verifyCode = ref('')
const verifyStatus = ref('')

function authHeaders() {
  return {
    authorization: `Bearer ${token.value}`
  }
}

function toInputDateValue(input: string) {
  const d = new Date(input)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function saveToken() {
  localStorage.setItem('adminToken', token.value)
  status.value = 'Token 已保存。'
}

async function loadConfig() {
  try {
    const cfg = await $fetch<DrawConfig>('/api/admin/draw-config', {
      headers: authHeaders()
    })
    drawAt.value = toInputDateValue(cfg.drawAt)
    ticketExpireAt.value = toInputDateValue(cfg.ticketExpireAt)
    winnerCount.value = cfg.winnerCount
    status.value = '配置读取成功。'
  } catch {
    status.value = '配置读取失败，请检查 Token。'
  }
}

async function saveConfig() {
  try {
    await $fetch('/api/admin/draw-config', {
      method: 'PUT',
      headers: authHeaders(),
      body: {
        drawAt: new Date(drawAt.value).toISOString(),
        ticketExpireAt: new Date(ticketExpireAt.value).toISOString(),
        winnerCount: winnerCount.value
      }
    })
    status.value = '配置保存成功。'
  } catch {
    status.value = '配置保存失败。'
  }
}

async function publishResults() {
  try {
    await $fetch('/api/admin/publish', {
      method: 'POST',
      headers: authHeaders()
    })
    status.value = '结果已公布。'
  } catch {
    status.value = '公布失败。'
  }
}

async function loadParticipants() {
  try {
    participants.value = await $fetch<Participant[]>('/api/admin/participants', {
      headers: authHeaders()
    })
  } catch {
    status.value = '名单读取失败。'
  }
}

async function verifyTicket() {
  verifyStatus.value = ''
  try {
    const res = await $fetch<{ ok: boolean; status: string }>('/api/admin/verify', {
      method: 'POST',
      headers: authHeaders(),
      body: { ticketCode: verifyCode.value, operator: 'admin' }
    })
    verifyStatus.value = `核销结果：${res.status}`
  } catch {
    verifyStatus.value = '核销失败或票码无效。'
  }
}

onMounted(() => {
  token.value = localStorage.getItem('adminToken') || ''
})
</script>

<style scoped>
.page {
  max-width: 900px;
  margin: 36px auto;
  padding: 16px;
  display: grid;
  gap: 20px;
}
section {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px;
  display: grid;
  gap: 10px;
}
table {
  border-collapse: collapse;
}
th,
td {
  border: 1px solid #ddd;
  padding: 6px 8px;
}
</style>
