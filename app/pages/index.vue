<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { showToast, showSuccessToast } from "vant";
import { buildFingerprintHash } from "../utils/fingerprint";

interface DrawConfig {
  drawAt: string;
  drawStatus: string;
  publishStatus: string;
  resultGeneratedAt: string | null;
  ticketExpireAt: string;
}

const config = ref<DrawConfig | null>(null);
const loading = ref(true);
const checkingParticipation = ref(true);
const showAgreement = ref(false);
const countdown = ref(10);
const agreed = ref(false);
const showForm = ref(false);
const submitted = ref(false);
const name = ref("");
const school = ref("");
const submitting = ref(false);
const fingerprintHash = ref("");

const drawAtFormatted = computed(() => {
  if (!config.value?.drawAt) return "";
  const date = new Date(config.value.drawAt);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const canAgree = computed(() => countdown.value <= 0);

const fetchConfig = async () => {
  try {
    const res = await $fetch<DrawConfig>("/api/public/draw-config");
    config.value = res;
  } catch (e) {
    showToast("获取配置失败");
  }
};

const checkParticipation = async () => {
  try {
    const fp = await buildFingerprintHash();
    fingerprintHash.value = fp;

    const result = await $fetch<{ participated: boolean }>(
      `/api/public/check-participation?fingerprintHash=${fp}`
    );

    if (result.participated) {
      submitted.value = true;
    }
  } catch (e) {
    console.error("检查参与状态失败", e);
  } finally {
    checkingParticipation.value = false;
  }
};

const handleParticipate = () => {
  showAgreement.value = true;
  countdown.value = 10;
  const timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
};

const handleAgree = () => {
  agreed.value = true;
  showAgreement.value = false;
  showForm.value = true;
};

const handleSubmit = async () => {
  if (!name.value.trim()) {
    showToast("请输入姓名");
    return;
  }
  if (!school.value.trim()) {
    showToast("请输入学校");
    return;
  }

  submitting.value = true;
  try {
    const fp = fingerprintHash.value || (await buildFingerprintHash());
    fingerprintHash.value = fp;

    const result = await $fetch<{ ok: boolean; duplicate: boolean; id?: string }>("/api/public/apply", {
      method: "POST",
      body: {
        name: name.value.trim(),
        school: school.value.trim(),
        fingerprintHash: fp,
      },
    });

    if (result.ok) {
      showForm.value = false;
      submitted.value = true;
      showSuccessToast("提交成功");
    }
  } catch (e: any) {
    showToast(e.data?.statusMessage || "提交失败");
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  await Promise.all([fetchConfig(), checkParticipation()]);
  loading.value = false;
});
</script>

<template>
  <div class="page-container">
    <div v-if="loading" class="loading-container">
      <van-loading size="24px">加载中...</van-loading>
    </div>

    <div v-else class="card-container">
      <div class="main-card">
        <div class="card-header">
          <div class="school-name">
            <van-icon name="school-o" />
            浙江省温州中学
          </div>
          <div class="event-name">2026年社团开放日</div>
          <div class="lottery-title">
            <van-icon name="gift-o" />
            门票抽奖
          </div>
        </div>
        <div class="card-body">
          <div class="draw-time">
            <van-icon name="clock-o" class="time-icon" />
            <span class="label">开奖时间：</span>
            <span class="time">{{ drawAtFormatted }}</span>
          </div>
          <div v-if="checkingParticipation" class="checking-status">
            <van-loading size="20px" />
            <span>检测参与状态...</span>
          </div>
          <van-button
            v-else-if="!submitted"
            type="primary"
            block
            round
            icon="edit"
            @click="handleParticipate"
          >
            参与抽奖
          </van-button>
          <div v-else class="waiting-status">
            <van-icon name="clock-o" />
            <span>等待开奖</span>
          </div>
        </div>
      </div>
    </div>

    <van-popup
      v-model:show="showAgreement"
      position="bottom"
      round
      :style="{ height: '60%' }"
    >
      <div class="agreement-popup">
        <div class="agreement-header">
          <van-icon name="description" class="header-icon" />
          <h3>用户协议</h3>
        </div>
        <div class="agreement-content">
          <p>欢迎使用社团开放日门票抽奖系统。</p>
          <p>在参与抽奖前，请仔细阅读以下条款：</p>
          <ol>
            <li>每位用户仅限参与一次抽奖。</li>
            <li>抽奖结果将在开奖时间后公布。</li>
            <li>中奖用户将获得门票二维码，请在有效期内使用。</li>
            <li>本活动最终解释权归浙江省温州中学所有。</li>
          </ol>
          <p>点击"同意并继续"即表示您已阅读并同意以上条款。</p>
        </div>
        <div class="agreement-footer">
          <van-button
            type="primary"
            block
            round
            :disabled="!canAgree"
            :icon="canAgree ? 'success' : 'clock'"
            @click="handleAgree"
          >
            {{ canAgree ? "同意并继续" : `请阅读 (${countdown}s)` }}
          </van-button>
        </div>
      </div>
    </van-popup>

    <van-popup
      v-model:show="showForm"
      position="bottom"
      round
      :style="{ height: '50%' }"
    >
      <div class="form-popup">
        <div class="form-header">
          <van-icon name="edit" class="header-icon" />
          <h3>填写信息</h3>
        </div>
        <div class="form-content">
          <van-cell-group inset>
            <van-field
              v-model="name"
              label="姓名"
              placeholder="请输入姓名"
              left-icon="user-o"
              :rules="[{ required: true, message: '请输入姓名' }]"
            />
            <van-field
              v-model="school"
              label="学校"
              placeholder="请输入学校"
              left-icon="wap-home-o"
              :rules="[{ required: true, message: '请输入学校' }]"
            />
          </van-cell-group>
        </div>
        <div class="form-footer">
          <van-button
            type="primary"
            block
            round
            :loading="submitting"
            icon="passed"
            @click="handleSubmit"
          >
            提交
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped lang="scss">
.page-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #e8f4fc 0%, #f5f7fa 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-container {
  width: 100%;
  max-width: 420px;
}

.main-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);

  .card-header {
    padding: 28px 24px;
    text-align: center;
    background: #fafafa;

    .school-name {
      font-size: 15px;
      font-weight: 500;
      color: #666;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .event-name {
      font-size: 20px;
      font-weight: bold;
      color: #333;
      margin-bottom: 16px;
    }

    .lottery-title {
      font-size: 28px;
      font-weight: bold;
      color: #1976d2;
      padding: 14px 0;
      border-top: 1px solid #eee;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
  }

  .card-body {
    padding: 24px;

    .draw-time {
      text-align: center;
      margin-bottom: 20px;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;

      .time-icon {
        color: #1976d2;
      }

      .label {
        color: #999;
      }

      .time {
        color: #333;
        font-weight: 500;
      }
    }

    .checking-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px;
      background: #f5f5f5;
      border-radius: 24px;
      color: #999;
      font-size: 16px;
    }

    .waiting-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px;
      background: #f5f5f5;
      border-radius: 24px;
      color: #999;
      font-size: 16px;
    }
  }
}

.agreement-popup,
.form-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.agreement-header,
.form-header {
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid #eee;

  .header-icon {
    font-size: 24px;
    color: #1976d2;
    margin-bottom: 8px;
  }

  h3 {
    margin: 0;
    font-size: 18px;
    color: #333;
  }
}

.agreement-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.8;
  color: #666;

  p {
    margin-bottom: 12px;
  }

  ol {
    padding-left: 20px;
    margin-bottom: 16px;

    li {
      margin-bottom: 8px;
    }
  }
}

.agreement-footer,
.form-footer {
  padding: 16px;
  border-top: 1px solid #eee;
}

.form-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}
</style>
