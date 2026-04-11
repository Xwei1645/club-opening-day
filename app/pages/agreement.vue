<template>
  <main class="page">
    <h1>参与协议</h1>
    <p>1. 每个设备仅可参与一次。</p>
    <p>2. 提交信息后等待开奖。</p>
    <p>3. 中奖后请在有效期内核销门票。</p>
    <button :disabled="!agreed" @click="goNext">同意并继续</button>
    <label class="agree-line">
      <input v-model="agreed" type="checkbox" />
      我已阅读并同意协议
    </label>
  </main>
</template>

<script setup lang="ts">
const agreed = ref(false)

function goNext() {
  if (!agreed.value) {
    return
  }
  localStorage.setItem('agreementAccepted', '1')
  navigateTo('/apply')
}
</script>

<style scoped>
.page {
  max-width: 720px;
  margin: 48px auto;
  padding: 16px;
}
.agree-line {
  display: block;
  margin-top: 12px;
}
button {
  margin-top: 16px;
}
</style>
