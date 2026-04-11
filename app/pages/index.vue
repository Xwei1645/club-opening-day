<template>
  <main class="page">
    <h1>开业日门票抽奖</h1>
    <p>先阅读协议，再提交报名信息，开奖后可查看门票。</p>
    <div class="actions">
      <NuxtLink to="/agreement">开始参与</NuxtLink>
      <NuxtLink to="/admin">管理员</NuxtLink>
    </div>
  </main>
</template>

<style scoped>
.page {
  max-width: 720px;
  margin: 48px auto;
  padding: 16px;
}
.actions {
  display: flex;
  gap: 16px;
}
</style>
