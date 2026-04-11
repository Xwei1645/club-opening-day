<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { showToast, showSuccessToast } from "vant";
import { buildFingerprintHash } from "../utils/fingerprint";
import QRCode from "qrcode";

interface DrawConfig {
  drawAt: string;
  drawStatus: string;
  publishStatus: string;
  resultGeneratedAt: string | null;
  ticketExpireAt: string;
}

interface TicketInfo {
  ticketCode: string;
  qrPayload: string;
  status: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

interface ResultData {
  participated: boolean;
  stage?: "waiting" | "hidden" | "win" | "lose";
  drawAt?: string;
  publishStatus?: string;
  resultGeneratedAt?: string;
  name?: string;
  school?: string;
  ticket?: TicketInfo;
}

const config = ref<DrawConfig | null>(null);
const loading = ref(true);
const showAgreement = ref(false);
const countdown = ref(10);
const agreed = ref(false);
const showForm = ref(false);
const name = ref("");
const school = ref("");
const submitting = ref(false);
const fingerprintHash = ref("");

const resultData = ref<ResultData | null>(null);
const qrDataUrl = ref("");

const isWinner = computed(() => resultData.value?.stage === "win");

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

const ticketCodeFormatted = computed(() => {
  const code = resultData.value?.ticket?.ticketCode;
  if (!code) return "";
  return `${code.slice(0, 4)} ${code.slice(4)}`;
});

const ticketExpiresAtFormatted = computed(() => {
  if (!resultData.value?.ticket?.expiresAt) return "";
  const date = new Date(resultData.value.ticket.expiresAt);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const isTicketExpired = computed(() => {
  if (!resultData.value?.ticket?.expiresAt) return false;
  return new Date(resultData.value.ticket.expiresAt) < new Date();
});

const isTicketUsed = computed(() => {
  return resultData.value?.ticket?.status === "USED";
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

const fetchResult = async () => {
  try {
    const fp = fingerprintHash.value || (await buildFingerprintHash());
    fingerprintHash.value = fp;

    const res = await $fetch<ResultData>(
      `/api/public/result?fingerprintHash=${fp}`
    );
    resultData.value = res;

    if (res.stage === "win" && res.ticket) {
      const qrUrl = res.ticket.qrPayload || res.ticket.ticketCode;
      qrDataUrl.value = await QRCode.toDataURL(qrUrl, {
        width: 200,
        margin: 2,
      });
    }
  } catch (e) {
    console.error("获取结果失败", e);
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
      showSuccessToast("提交成功");
      await fetchResult();
    }
  } catch (e: any) {
    showToast(e.data?.statusMessage || "提交失败");
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  await Promise.all([fetchConfig(), fetchResult()]);
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
            <van-icon :name="isWinner ? 'ticket' : 'gift-o'" />
            {{ isWinner ? "活动门票" : "门票抽奖" }}
          </div>
        </div>
        <div class="card-body">
          <div v-if="!isWinner" class="draw-time">
            <van-icon name="clock-o" class="time-icon" />
            <span class="label">开奖时间</span>
            <span class="time">{{ drawAtFormatted }}</span>
          </div>

          <template v-if="!resultData?.participated">
            <van-button
              type="primary"
              block
              round
              icon="edit"
              @click="handleParticipate"
            >
              参与抽奖
            </van-button>
          </template>

          <template v-else-if="resultData">
            <template v-if="resultData.stage === 'waiting'">
              <div class="status-box">
                <van-icon name="clock-o" class="status-icon" />
                <div class="status-text">等待开奖</div>
              </div>
            </template>

            <template v-else-if="resultData.stage === 'hidden'">
              <div class="status-box">
                <van-icon name="eye-o" class="status-icon" />
                <div class="status-text">已开奖，结果暂未公开</div>
              </div>
            </template>

            <template v-else-if="resultData.stage === 'lose'">
              <div class="status-box">
                <van-icon name="close" class="status-icon" />
                <div class="status-text">很遗憾，未中奖</div>
              </div>
            </template>

            <template v-else-if="resultData.stage === 'win' && resultData.ticket">
              <div class="ticket-section">
                <div v-if="isTicketUsed" class="ticket-status used">
                  <van-icon name="clear" />
                  <span>门票已使用</span>
                </div>
                <div v-else-if="isTicketExpired" class="ticket-status expired">
                  <van-icon name="warning-o" />
                  <span>门票已过期</span>
                </div>
                <div v-else class="ticket-status valid">
                  <van-icon name="qr" />
                  <span>请向工作人员出示二维码，有序检票入场</span>
                </div>

                <div class="ticket-info">
                  <div class="info-item">
                    <span class="label">姓名</span>
                    <span class="value">{{ resultData.name }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">学校</span>
                    <span class="value">{{ resultData.school }}</span>
                  </div>
                </div>

                <div class="qr-code" :class="{ disabled: isTicketUsed || isTicketExpired }">
                  <img :src="qrDataUrl" alt="门票二维码" />
                </div>

                <div class="ticket-code">
                  <span class="label">验证码</span>
                  <span class="code">{{ ticketCodeFormatted }}</span>
                </div>

                <div class="ticket-expire">
                  <span class="label">有效期至</span>
                  <span class="time">{{ ticketExpiresAtFormatted }}</span>
                </div>
              </div>
            </template>
          </template>
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
    padding: 32px 24px 24px;
    text-align: center;

    .school-name {
      font-size: 15px;
      font-weight: 500;
      color: #666;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .event-name {
      font-size: 20px;
      font-weight: bold;
      color: #333;
      margin-bottom: 12px;
    }

    .lottery-title {
      font-size: 28px;
      font-weight: bold;
      color: #1976d2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
  }

  .card-body {
    padding: 20px 24px 28px;

    .draw-time {
      text-align: center;
      margin-bottom: 16px;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;

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

    .status-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      gap: 10px;

      .status-icon {
        font-size: 36px;
        color: #999;
      }

      .status-text {
        font-size: 16px;
        font-weight: 500;
        color: #666;
      }
    }

    .ticket-section {
      text-align: center;

      .ticket-status {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 16px;

        &.valid {
          background: #e8f5e9;
          color: #2e7d32;
        }

        &.used {
          background: #f5f5f5;
          color: #666;
        }

        &.expired {
          background: #ffebee;
          color: #c62828;
        }
      }

      .ticket-info {
        display: flex;
        justify-content: center;
        gap: 24px;
        margin-bottom: 16px;

        .info-item {
          display: flex;
          align-items: center;
          gap: 6px;

          .label {
            color: #999;
            font-size: 14px;
          }

          .value {
            color: #333;
            font-size: 14px;
            font-weight: 500;
          }
        }
      }

      .qr-code {
        padding: 12px;
        background: #fff;
        border-radius: 12px;
        display: inline-block;
        margin-bottom: 16px;

        &.disabled {
          filter: grayscale(100%);
          opacity: 0.5;
        }

        img {
          width: 180px;
          height: 180px;
        }
      }

      .ticket-code {
        margin-bottom: 8px;

        .label {
          color: #999;
          font-size: 14px;
          margin-right: 6px;
        }

        .code {
          color: #1976d2;
          font-size: 18px;
          font-weight: bold;
          font-family: monospace;
          letter-spacing: 2px;
        }
      }

      .ticket-expire {
        .label {
          color: #999;
          font-size: 12px;
          margin-right: 6px;
        }

        .time {
          color: #666;
          font-size: 12px;
        }
      }
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
