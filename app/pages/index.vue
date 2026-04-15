<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

useHead({
  title: "活动抽奖",
});
import { showToast, showSuccessToast } from "vant";
import {
  buildFingerprintHash,
  updateFingerprint,
  getLocalRecoverCode,
  setLocalRecoverCode,
} from "../utils/fingerprint";
import QRCode from "qrcode";

interface DrawConfig {
  drawAt: string;
  drawStatus: string;
  publishStatus: string;
  resultGeneratedAt: string | null;
  ticketExpireAt: string;
  wechatQrCodeUrl?: string | null;
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
  recoverCode?: string;
  ticket?: TicketInfo;
}

interface ParticipantInfo {
  id: string;
  name: string;
  school: string;
  createdAt: string;
}

const config = ref<DrawConfig | null>(null);
const loading = ref(true);
const showAgreement = ref(false);
const countdown = ref(10);
const scrolledToBottom = ref(false);
const agreed = ref(false);
const showForm = ref(false);
const name = ref("");
const school = ref("");
const submitting = ref(false);
const fingerprintHash = ref("");

const resultData = ref<ResultData | null>(null);
const qrDataUrl = ref("");
const showWechatQrPopup = ref(false);
const showWechatTip = ref(true);
const wechatQrDataUrl = ref("");

const showRecoverCodePopup = ref(false);
const showIdentityConfirmPopup = ref(false);
const showNameVerifyPopup = ref(false);
const pendingParticipants = ref<ParticipantInfo[]>([]);
const selectedParticipant = ref<ParticipantInfo | null>(null);
const verifyName = ref("");
const verifying = ref(false);
const identityRejected = ref(false);

const showRebindPopup = ref(false);
const rebindRecoverCode = ref("");
const rebinding = ref(false);

onMounted(async () => {
  const tipClosed = localStorage.getItem("wechatTipClosed");
  if (tipClosed === "true") {
    showWechatTip.value = false;
  }

  const rejected = localStorage.getItem("identityRejected");
  if (rejected === "true") {
    identityRejected.value = true;
  }

  await fetchConfig();

  const localRecoverCode = getLocalRecoverCode();
  if (localRecoverCode) {
    await fetchResult();
  } else {
    await checkFingerprint();
  }

  loading.value = false;
});

const closeWechatTip = () => {
  showWechatTip.value = false;
  localStorage.setItem("wechatTipClosed", "true");
};

const maskName = (name: string): string => {
  if (name.length === 2) {
    return name[0] + "*";
  } else if (name.length === 3) {
    return name[0] + "*" + name[2];
  } else if (name.length === 4) {
    return name[0] + "*" + name[2] + name[3];
  }
  return name;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });
};

const handleRebind = async () => {
  if (!rebindRecoverCode.value.trim()) {
    showToast("请输入找回码");
    return;
  }

  if (rebindRecoverCode.value.trim().length !== 6) {
    showToast("找回码为6位");
    return;
  }

  rebinding.value = true;
  try {
    const res = await $fetch<{
      ok: boolean;
      participant: { recoverCode: string };
    }>("/api/public/recover", {
      method: "POST",
      body: {
        recoverCode: rebindRecoverCode.value.trim().toUpperCase(),
      },
    });

    if (res.ok && res.participant.recoverCode) {
      setLocalRecoverCode(res.participant.recoverCode);
      showRebindPopup.value = false;
      rebindRecoverCode.value = "";
      showSuccessToast("找回成功");
      await fetchResult();
    }
  } catch (e: any) {
    showToast(e.data?.statusMessage || "找回失败");
  } finally {
    rebinding.value = false;
  }
};

const handleIdentityConfirm = (participant: ParticipantInfo) => {
  selectedParticipant.value = participant;
  showIdentityConfirmPopup.value = false;
  showNameVerifyPopup.value = true;
};

const handleRejectIdentity = () => {
  showIdentityConfirmPopup.value = false;
  identityRejected.value = true;
  localStorage.setItem("identityRejected", "true");
};

const handleNameVerify = async () => {
  if (!verifyName.value.trim()) {
    showToast("请输入姓名");
    return;
  }

  if (!selectedParticipant.value) {
    return;
  }

  verifying.value = true;
  try {
    const res = await $fetch<{
      ok: boolean;
      participant: { recoverCode: string };
    }>("/api/public/verify-identity", {
      method: "POST",
      body: {
        id: selectedParticipant.value.id,
        name: verifyName.value.trim(),
      },
    });

    if (res.ok && res.participant.recoverCode) {
      setLocalRecoverCode(res.participant.recoverCode);
      showNameVerifyPopup.value = false;
      verifyName.value = "";
      selectedParticipant.value = null;
      pendingParticipants.value = [];
      showSuccessToast("验证成功");
      await fetchResult();
    }
  } catch (e: any) {
    showToast(e.data?.statusMessage || "验证失败");
  } finally {
    verifying.value = false;
  }
};

const copyRecoverCode = () => {
  if (resultData.value?.recoverCode) {
    navigator.clipboard.writeText(resultData.value.recoverCode);
    showSuccessToast("已复制");
  }
};

const isWinner = computed(() => resultData.value?.stage === "win");

const isDrawDone = computed(() => config.value?.drawStatus === "DONE");

const isResultPublished = computed(
  () => config.value?.publishStatus === "PUBLIC",
);

const showRegistrationClosed = computed(
  () =>
    isDrawDone.value &&
    !isResultPublished.value &&
    !resultData.value?.participated,
);

const showEventEnded = computed(
  () => isDrawDone.value && isResultPublished.value && !resultData.value?.participated,
);

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

const canAgree = computed(() => countdown.value <= 0 && scrolledToBottom.value);

const agreeButtonText = computed(() => {
  if (canAgree.value) return "同意并继续";
  if (countdown.value > 0 && !scrolledToBottom.value) {
    return `请阅读并滑到底部 (${countdown.value}s)`;
  }
  if (countdown.value > 0) {
    return `请阅读 (${countdown.value}s)`;
  }
  return "请滑动到底部";
});

const fetchConfig = async () => {
  try {
    const res = await $fetch<DrawConfig>("/api/public/draw-config");
    config.value = res;

    if (res.wechatQrCodeUrl) {
      wechatQrDataUrl.value = await QRCode.toDataURL(res.wechatQrCodeUrl, {
        width: 200,
        margin: 2,
      });
    }
  } catch (e) {
    showToast("获取配置失败");
  }
};

const fetchResult = async () => {
  try {
    const localRecoverCode = getLocalRecoverCode();
    if (!localRecoverCode) {
      return;
    }

    const res = await $fetch<ResultData>(
      `/api/public/result?recoverCode=${localRecoverCode}`,
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

const checkFingerprint = async () => {
  if (identityRejected.value) {
    return;
  }

  try {
    const fp = await buildFingerprintHash();
    fingerprintHash.value = fp;

    const res = await $fetch<{
      found: boolean;
      participants?: ParticipantInfo[];
    }>(`/api/public/check-fingerprint?fingerprintHash=${fp}`);

    if (res.found && res.participants && res.participants.length > 0) {
      pendingParticipants.value = res.participants;
      showIdentityConfirmPopup.value = true;
    }
  } catch (e) {
    console.error("检查指纹失败", e);
  }
};

const handleParticipate = () => {
  showAgreement.value = true;
  countdown.value = 10;
  scrolledToBottom.value = false;
  const timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
};

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  const isAtBottom =
    target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
  if (isAtBottom) {
    scrolledToBottom.value = true;
  }
};

const handleAgree = () => {
  agreed.value = true;
  showAgreement.value = false;
  showForm.value = true;
};

const handleSubmit = async () => {
  const chineseRegex = /^[\u4e00-\u9fa5]+$/;
  const trimmedName = name.value.trim();
  const trimmedSchool = school.value.trim();

  if (!trimmedName) {
    showToast("请输入姓名");
    return;
  }
  if (!chineseRegex.test(trimmedName)) {
    showToast("姓名必须为中文");
    return;
  }
  if (trimmedName.length < 2 || trimmedName.length > 4) {
    showToast("姓名需要2-4个中文字");
    return;
  }
  if (!trimmedSchool) {
    showToast("请输入学校");
    return;
  }
  if (!chineseRegex.test(trimmedSchool)) {
    showToast("学校名称必须为中文");
    return;
  }
  if (trimmedSchool.length < 3) {
    showToast("学校名称需要至少3个字");
    return;
  }

  submitting.value = true;
  try {
    const fp = fingerprintHash.value || (await buildFingerprintHash());
    fingerprintHash.value = fp;

    const result = await $fetch<{
      ok: boolean;
      duplicate: boolean;
      id?: string;
      recoverCode?: string;
    }>("/api/public/apply", {
      method: "POST",
      body: {
        name: name.value.trim(),
        school: school.value.trim(),
        fingerprintHash: fp,
      },
    });

    if (result.ok && result.recoverCode) {
      setLocalRecoverCode(result.recoverCode);
      showForm.value = false;

      if (!result.duplicate) {
        await fetchResult();
        showRecoverCodePopup.value = true;
      } else {
        showSuccessToast("提交成功");
      }

      if (result.duplicate) {
        await fetchResult();
      }
    }
  } catch (e: any) {
    showToast(e.data?.statusMessage || "提交失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="page-container">
    <div v-if="loading" class="loading-container">
      <van-loading size="24px">加载中...</van-loading>
    </div>

    <div v-else class="card-container">
      <div class="main-card" :class="{ 'ticket-card': isWinner }">
        <div class="card-header">
          <div class="school-name">
            <van-icon name="school-o" />
            浙江省温州中学
          </div>
          <div class="event-name">2026年社团开放日</div>
          <div class="lottery-title">
            <van-icon :name="isWinner ? 'coupon' : 'gift-o'" />
            {{ isWinner ? "电子门票" : "门票抽奖" }}
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
              v-if="showRegistrationClosed"
              disabled
              block
              round
              icon="info-o"
              class="disabled-btn"
            >
              报名截止
            </van-button>
            <van-button
              v-else-if="showEventEnded"
              disabled
              block
              round
              icon="warning-o"
              class="disabled-btn"
            >
              活动已结束
            </van-button>
            <van-button
              v-else
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
            <div
              v-if="
                !(
                  resultData.stage === 'win' &&
                  resultData.ticket
                )
              "
              class="ticket-info"
            >
              <div class="info-item">
                <span class="label">姓名</span>
                <span class="value">{{ resultData.name }}</span>
              </div>
              <div class="info-item">
                <span class="label">学校</span>
                <span class="value">{{ resultData.school }}</span>
              </div>
            </div>

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

            <template
              v-else-if="resultData.stage === 'win' && resultData.ticket"
            >
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
                  <van-icon name="scan" />
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

                <div
                  class="qr-code"
                  :class="{ disabled: isTicketUsed || isTicketExpired }"
                >
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

                <div v-if="config?.wechatQrCodeUrl" class="wechat-section">
                  <div v-if="showWechatTip" class="wechat-tip">
                    <span>请加入观众微信群获取活动最新动态</span>
                    <van-icon
                      name="cross"
                      class="close-icon"
                      @click="closeWechatTip"
                    />
                  </div>
                  <div class="wechat-link" @click="showWechatQrPopup = true">
                    观众微信群二维码
                  </div>
                </div>
              </div>
            </template>
          </template>
        </div>
        <div v-if="!resultData?.participated" class="card-footer">
          <span class="recover-link" @click="showRebindPopup = true"
            >找回抽奖记录</span
          >
        </div>
        <div v-else-if="resultData?.recoverCode" class="card-footer">
          <span class="recover-link" @click="showRecoverCodePopup = true"
            >找回码</span
          >
        </div>
      </div>
    </div>

    <van-popup
      v-model:show="showRebindPopup"
      round
      :style="{ padding: '24px', width: '80%', maxWidth: '320px' }"
    >
      <div class="rebind-popup">
        <h4 class="popup-title">找回抽奖记录</h4>
        <p class="popup-desc">如您不知道这是什么或遗忘找回码，请联系工作人员</p>
        <van-field
          v-model="rebindRecoverCode"
          maxlength="6"
          placeholder="请输入6位找回码"
          class="rebind-input"
        />
        <div class="rebind-actions">
          <van-button block round @click="showRebindPopup = false"
            >取消</van-button
          >
          <van-button
            type="primary"
            block
            round
            :loading="rebinding"
            @click="handleRebind"
            >确认</van-button
          >
        </div>
      </div>
    </van-popup>

    <van-popup
      v-model:show="showRecoverCodePopup"
      round
      :style="{ padding: '24px', width: '80%', maxWidth: '320px' }"
    >
      <div class="recover-code-popup">
        <h4 class="popup-title">您的找回码</h4>
        <div class="recover-code-display">{{ resultData?.recoverCode }}</div>
        <p class="popup-hint">
          请保存此找回码，抽奖记录丢失时您可通过找回码恢复
        </p>
        <div class="recover-code-actions">
          <van-button block round @click="copyRecoverCode"
            >复制找回码</van-button
          >
          <van-button
            type="primary"
            block
            round
            @click="showRecoverCodePopup = false"
            >关闭</van-button
          >
        </div>
      </div>
    </van-popup>

    <van-popup
      v-model:show="showIdentityConfirmPopup"
      round
      :style="{ padding: '24px', width: '80%', maxWidth: '360px' }"
    >
      <div class="identity-confirm-popup">
        <h4 class="popup-title">身份确认</h4>

        <template
          v-if="pendingParticipants.length === 1 && pendingParticipants[0]"
        >
          <p class="popup-desc">这是您的信息吗？</p>
          <div class="participant-card">
            <div class="participant-name">
              {{ maskName(pendingParticipants[0].name) }}
            </div>
            <div class="participant-school">
              {{ pendingParticipants[0].school }}
            </div>
            <div class="participant-date">
              {{ formatDate(pendingParticipants[0].createdAt) }}报名
            </div>
          </div>
          <div class="identity-actions">
            <van-button block round @click="handleRejectIdentity"
              >这不是我</van-button
            >
            <van-button
              type="primary"
              block
              round
              @click="handleIdentityConfirm(pendingParticipants[0]!)"
              >是的，是我</van-button
            >
          </div>
        </template>

        <template v-else-if="pendingParticipants.length > 1">
          <p class="popup-desc">找到多条匹配记录，请选择：</p>
          <div class="participant-list">
            <div
              v-for="(p, index) in pendingParticipants"
              :key="p.id"
              class="participant-item"
              @click="handleIdentityConfirm(p)"
            >
              <div class="participant-name">{{ maskName(p.name) }}</div>
              <div class="participant-info">
                {{ p.school }} | {{ formatDate(p.createdAt) }}报名
              </div>
            </div>
          </div>
          <van-button block round @click="handleRejectIdentity"
            >都不是我</van-button
          >
        </template>
      </div>
    </van-popup>

    <van-popup
      v-model:show="showNameVerifyPopup"
      round
      :style="{ padding: '24px', width: '80%', maxWidth: '320px' }"
    >
      <div class="name-verify-popup">
        <h4 class="popup-title">验证身份</h4>
        <p class="popup-desc">请输入您的完整姓名以验证身份</p>
        <van-field
          v-model="verifyName"
          label="姓名"
          placeholder="请输入完整姓名"
          class="verify-input"
        />
        <div class="verify-actions">
          <van-button
            block
            round
            @click="
              showNameVerifyPopup = false;
              verifyName = '';
            "
            >取消</van-button
          >
          <van-button
            type="primary"
            block
            round
            :loading="verifying"
            @click="handleNameVerify"
            >确认</van-button
          >
        </div>
      </div>
    </van-popup>

    <van-popup
      v-model:show="showAgreement"
      position="bottom"
      round
      :style="{ height: '80%' }"
    >
      <div class="agreement-popup">
        <div class="agreement-header">
          <van-icon name="description" class="header-icon" />
          <h3>用户协议及隐私政策</h3>
        </div>
        <div class="agreement-content" @scroll="handleScroll">
          <h4 class="main-title">浙江省温州中学2026年社团开放日门票抽奖活动</h4>
          <h4 class="sub-title">用户协议及隐私政策</h4>

          <div class="section">
            <h5 class="section-title">第一部分 用户协议</h5>

            <div class="article">
              <h6 class="article-title">一、协议主体与适用范围</h6>
              <p>
                1.
                本次活动由浙江省温州中学社团联合办（以下简称"主办方"）主办，本协议系主办方与活动参与用户（以下简称"用户"），就浙江省温州中学2026年社团开放日门票抽奖活动相关事宜达成的有效约定。
              </p>
              <p>
                2.
                本协议适用于所有参与本次抽奖活动的用户。用户进入抽奖页面、完成抽奖操作行为，即视为已充分阅读、明晰并完全同意本协议全部条款，自愿接受协议约束。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">二、活动参与规则</h6>
              <p>
                1.
                <strong>参与资格</strong
                >：<strong>仅限非浙江省温州中学在校学生参与</strong>，浙江省温州中学在校学生参与本次抽奖的，其参与及中奖结果均视为无效。
              </p>
              <p>
                2.
                <strong>参与方式</strong
                >：用户通过主办方指定的活动网页，按照页面提示完成相关操作，即可参与本次抽奖活动。
              </p>
              <p>
                3.
                <strong>参与次数</strong
                >：为保障活动公平性，同一用户仅限参与一次抽奖，同一姓名、同一设备均认定为同一用户，禁止重复参与、恶意刷取抽奖资格，严禁借助外挂、脚本等工具违规参与活动。
              </p>
              <p>
                4.
                <strong>开奖方式</strong
                >：本次活动采用定时开奖模式，具体开奖时间于活动网站首页予以公示，开奖结果同步在活动网站正式公布。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">三、中奖及电子门票查询规则</h6>
              <p>
                1.
                主办方将按照<strong>随机抽取</strong>原则确定中奖用户，中奖结果以活动网站公示内容为准，主办方不另行发送系统通知。
              </p>
              <p>2. 中奖用户登录活动网站，即可查询并获取本人专属电子门票。</p>
              <p>
                3.
                若用户存在违规参与行为，主办方有权直接取消其中奖资格，注销对应电子门票，且不予补充抽取中奖名额。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">四、电子门票使用及入场规范</h6>
              <p>
                1.
                本次活动奖品为浙江省温州中学2026年社团开放日电子门票，仅限本次社团开放日作为入场凭证使用。
              </p>
              <p>
                2.
                中奖用户须在活动规定时段内抵达现场，按照现场工作人员指引完成检票入场流程。
              </p>
              <p>
                3.
                电子门票<strong>仅限中奖用户本人使用</strong>，不得兑换现金、不得转售、不得转让。
              </p>
              <p>
                4.
                用户须保证所提交的个人信息真实、准确，因信息填写错误、虚假不实导致无法查询电子门票、无法完成检票入场的，相关责任由用户自行承担。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">五、用户权利与义务</h6>
              <p>
                1.
                用户有权依据本协议约定，公平参与本次抽奖活动，符合中奖条件的，可登录活动网站查询本人电子门票。
              </p>
              <p>
                2.
                用户须严格遵守本协议及活动相关规则，秉持诚信原则参与活动，不得扰乱活动正常开展秩序。
              </p>
              <p>
                3.
                用户须按照主办方要求，填报真实有效的个人信息，并配合主办方完成信息核验相关工作。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">六、主办方权利与义务</h6>
              <p>
                1.
                主办方将遵循公平、公正原则开展抽奖活动，按期完成开奖、结果公示及电子门票生成工作。
              </p>
              <p>
                2.
                主办方有权对用户参与行为进行合规核查，对存在违规作弊、扰乱活动秩序行为的用户，取消其参与及中奖资格，下架对应电子门票。
              </p>
              <p>
                3.
                因活动开展情况、网络故障、学校工作安排、政策调整等客观因素，主办方在活动网站提前公示后，可对活动时间、开奖安排等内容进行调整、暂停或终止，无需承担违约责任。
              </p>
              <p>
                4.
                主办方将妥善保管用户提交的个人信息，严格按照本文件隐私政策相关条款，规范使用并保障用户信息安全。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">七、免责条款</h6>
              <p>
                1.
                因网络故障、系统维护、网络拥堵、自然灾害、学校政策调整等非主办方主观过错导致的活动无法正常开展、抽奖失败、开奖延迟、电子门票查询异常等情形，主办方不承担违约责任。
              </p>
              <p>
                2.
                因用户自身操作失误、设备故障、不符合参与资格、提交虚假信息等个人原因，导致无法参与抽奖或无法查询、使用电子门票的，主办方不承担任何责任。
              </p>
              <p>
                3.
                活动因客观原因调整、暂停或终止后，主办方无需向用户进行额外补偿。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">八、协议变更与终止</h6>
              <p>
                1.
                主办方可根据活动实际需求、相关管理要求，对本协议条款进行修订、补充，修订后的协议内容于活动网站公示后即时生效。
              </p>
              <p>
                2.
                用户若不同意修订后的协议条款，可立即停止参与活动；用户继续参与活动的，视为同意并接受修订后的全部条款。
              </p>
              <p>
                3.
                本次抽奖活动全部流程完结，或用户因违规行为被取消参与资格的，本协议自动终止。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">九、其他条款</h6>
              <p>
                1.
                本次浙江省温州中学2026年社团开放日门票抽奖活动<strong>最终解释权归浙江省温州中学社团联合会所有</strong>。
              </p>
              <p>2. 若本协议部分条款被认定为无效，不影响其余条款的法律效力。</p>
              <p>3. 活动相关通知、主办方联系方式，均以活动网站公示内容为准。</p>
            </div>
          </div>

          <div class="section">
            <h5 class="section-title">第二部分 隐私政策</h5>

            <div class="article">
              <h6 class="article-title">一、信息收集范围</h6>
              <p>
                主办方仅为本次抽奖活动资格核验、中奖信息核实、电子门票身份确认及现场检票入场需要，收集用户填报的姓名、联系方式等基础个人信息，不收集与本次活动无关的其他个人信息。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">二、信息使用规范</h6>
              <p>
                1.
                用户提交的个人信息，仅用于本次抽奖活动资格审核、中奖公示、电子门票身份核验及现场入场核实，不用于其他任何无关用途。
              </p>
              <p>
                2.
                主办方不得向任何第三方泄露、出售、出租用户个人信息，法律法规另有规定或取得用户明确书面同意的除外。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">三、信息安全保障</h6>
              <p>
                1.
                主办方将采取合理的技术及管理措施，妥善保管用户个人信息，防范信息泄露、丢失、篡改等情况发生，切实保障用户信息安全。
              </p>
              <p>
                2.
                本次活动全部流程结束后，主办方将按照相关规定，及时清理并删除用户提交的个人信息，不再留存。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">四、用户信息相关权利</h6>
              <p>
                用户有权查询本人所提交的个人信息，如需修改、删除相关信息，可通过活动网站公示的联系方式与主办方对接处理。
              </p>
            </div>

            <div class="article">
              <h6 class="article-title">五、政策修订</h6>
              <p>
                主办方可根据活动实际情况对本隐私政策进行调整，调整后的内容于活动网站公示后生效。
              </p>
            </div>
          </div>
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
            {{ agreeButtonText }}
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

    <van-popup
      v-model:show="showWechatQrPopup"
      round
      :style="{ padding: '24px', width: '80%', maxWidth: '320px' }"
    >
      <div class="wechat-qr-popup">
        <h4 class="popup-title">观众微信群</h4>
        <p class="popup-desc">
          请扫描下方二维码加入观众微信群，获取活动最新动态
        </p>
        <div class="qr-image">
          <img :src="wechatQrDataUrl" alt="微信群二维码" />
        </div>
        <van-button
          type="primary"
          block
          round
          @click="showWechatQrPopup = false"
        >
          关闭
        </van-button>
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
  padding: 12px;
}

.main-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);

  &.ticket-card {
    position: relative;
    border-radius: 16px;
    background: #fff;
    margin: 12px 0;

    .card-header {
      position: relative;

      &::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 24px;
        right: 24px;
        height: 1px;
        background: repeating-linear-gradient(
          90deg,
          #ddd 0,
          #ddd 8px,
          transparent 8px,
          transparent 16px
        );
      }
    }
  }

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

  .card-footer {
    padding: 12px 24px 16px;
    text-align: center;

    .recover-link {
      font-size: 12px;
      color: #999;
      cursor: pointer;

      &:hover {
        color: #666;
      }
    }
  }

  .card-body {
    padding: 20px 24px 28px;

    .disabled-btn {
      background-color: #aaaaaa;
      color: #fff;
      border: none;
    }

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

      .wechat-section {
        margin-top: 16px;

        .wechat-tip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: #fff3e0;
          border-radius: 6px;
          margin-bottom: 8px;
          font-size: 12px;
          color: #e65100;
          text-align: left;

          .close-icon {
            flex-shrink: 0;
            margin-left: 8px;
            cursor: pointer;
            font-size: 14px;
            color: #e65100;
          }
        }

        .wechat-link {
          color: #1976d2;
          font-size: 14px;
          cursor: pointer;
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
  font-size: 13px;
  line-height: 1.8;
  color: #555;

  .main-title {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    text-align: center;
    margin-bottom: 8px;
  }

  .sub-title {
    font-size: 15px;
    font-weight: bold;
    color: #333;
    text-align: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #eee;
  }

  .section {
    margin-bottom: 16px;

    .section-title {
      font-size: 15px;
      font-weight: bold;
      color: #1976d2;
      margin-bottom: 12px;
      padding: 8px 0;
      border-bottom: 1px dashed #ddd;
    }

    .article {
      margin-bottom: 12px;

      .article-title {
        font-size: 14px;
        font-weight: bold;
        color: #333;
        margin-bottom: 8px;
      }

      p {
        margin-bottom: 6px;
        text-indent: 0;

        strong {
          color: #333;
        }
      }
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

.rebind-popup {
  text-align: center;

  .popup-title {
    margin: 0 0 8px;
    font-size: 18px;
    color: #333;
  }

  .popup-desc {
    margin: 0 0 16px;
    font-size: 13px;
    color: #666;
  }

  .rebind-input {
    margin-bottom: 16px;
  }

  .rebind-actions {
    display: flex;
    gap: 12px;

    .van-button {
      flex: 1;
    }
  }
}

.recover-code-popup {
  text-align: center;

  .popup-title {
    margin: 0 0 16px;
    font-size: 18px;
    color: #333;
  }

  .recover-code-display {
    font-size: 32px;
    font-weight: bold;
    color: #1976d2;
    letter-spacing: 4px;
    margin-bottom: 16px;
    font-family: monospace;
  }

  .popup-hint {
    margin: 0 0 16px;
    font-size: 12px;
    color: #999;
  }

  .recover-code-actions {
    display: flex;
    gap: 12px;

    .van-button {
      flex: 1;
    }
  }
}

.identity-confirm-popup {
  text-align: center;

  .popup-title {
    margin: 0 0 12px;
    font-size: 18px;
    color: #333;
  }

  .popup-desc {
    margin: 0 0 16px;
    font-size: 14px;
    color: #666;
  }

  .participant-card {
    background: #f5f7fa;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;

    .participant-name {
      font-size: 18px;
      font-weight: bold;
      color: #333;
      margin-bottom: 8px;
    }

    .participant-school {
      font-size: 14px;
      color: #666;
      margin-bottom: 4px;
    }

    .participant-date {
      font-size: 12px;
      color: #999;
    }
  }

  .participant-list {
    margin-bottom: 16px;
    max-height: 240px;
    overflow-y: auto;

    .participant-item {
      background: #f5f7fa;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 8px;
      cursor: pointer;
      text-align: left;

      &:hover {
        background: #e8f4fc;
      }

      .participant-name {
        font-size: 16px;
        font-weight: bold;
        color: #333;
        margin-bottom: 4px;
      }

      .participant-info {
        font-size: 12px;
        color: #666;
      }
    }
  }

  .identity-actions {
    display: flex;
    gap: 12px;

    .van-button {
      flex: 1;
    }
  }
}

.name-verify-popup {
  text-align: center;

  .popup-title {
    margin: 0 0 8px;
    font-size: 18px;
    color: #333;
  }

  .popup-desc {
    margin: 0 0 16px;
    font-size: 13px;
    color: #666;
  }

  .verify-input {
    margin-bottom: 16px;
  }

  .verify-actions {
    display: flex;
    gap: 12px;

    .van-button {
      flex: 1;
    }
  }
}

.wechat-qr-popup {
  text-align: center;

  .popup-title {
    margin: 0 0 8px;
    font-size: 18px;
    color: #333;
  }

  .popup-desc {
    margin: 0 0 16px;
    font-size: 13px;
    color: #666;
  }

  .qr-image {
    margin-bottom: 16px;

    img {
      width: 200px;
      height: 200px;
      border-radius: 8px;
    }
  }
}
</style>
