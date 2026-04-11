<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { showToast, showSuccessToast, showConfirmDialog } from "vant";

interface DrawConfig {
  id: number;
  drawAt: string;
  drawStatus: string;
  publishStatus: string;
  resultGeneratedAt: string | null;
  ticketExpireAt: string;
  winnerCount: number;
}

interface Participant {
  id: string;
  name: string;
  school: string;
  drawResult: string;
  createdAt: string;
  ip: string;
  userAgent: string;
  fingerprintHash: string;
  ticket: {
    ticketCode: string;
    status: string;
    issuedAt: string;
    expiresAt: string;
  } | null;
}

interface Winner {
  id: string;
  name: string;
  school: string;
  createdAt: string;
  ticket: {
    ticketCode: string;
    status: string;
    issuedAt: string;
    expiresAt: string;
    usedAt: string | null;
  } | null;
}

const password = ref("");
const isLoggedIn = ref(false);
const loading = ref(false);

const config = ref<DrawConfig | null>(null);
const participants = ref<Participant[]>([]);
const winners = ref<Winner[]>([]);

const showDatePicker = ref(false);
const showTimePicker = ref(false);
const showExpirePicker = ref(false);
const showExpireTimePicker = ref(false);
const showParticipantsModal = ref(false);
const showWinnersModal = ref(false);
const expandedParticipant = ref<string | null>(null);

const configForm = ref({
  drawAt: "",
  drawAtTime: "",
  ticketExpireAt: "",
  ticketExpireAtTime: "",
  winnerCount: "10",
});

const now = new Date();
const minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

const currentDate = ref([
  String(now.getFullYear()),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
]);
const currentTime = ref([
  String(now.getHours()).padStart(2, "0"),
  String(now.getMinutes()).padStart(2, "0"),
]);
const expireDate = ref([
  String(now.getFullYear()),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
]);
const expireTime = ref([
  String(now.getHours()).padStart(2, "0"),
  String(now.getMinutes()).padStart(2, "0"),
]);

const drawStatusText = computed(() => {
  if (!config.value) return "未知";
  return config.value.drawStatus === "DONE" ? "已开奖" : "待开奖";
});

const winnerCount = computed(() => {
  return participants.value.filter((p) => p.drawResult === "WIN").length;
});

const pendingCount = computed(() => {
  return participants.value.filter((p) => p.drawResult === "PENDING").length;
});

const formatDate = (dateArr: string[]) => {
  return `${dateArr[0]}-${dateArr[1]}-${dateArr[2]}`;
};

const formatTime = (timeArr: string[]) => {
  return `${timeArr[0]}:${timeArr[1]}`;
};

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN");
};

const formatTicketCode = (code: string) => {
  if (!code || code.length !== 8) return code;
  return `${code.slice(0, 4)} ${code.slice(4)}`;
};

const handleLogin = () => {
  if (!password.value.trim()) {
    showToast("请输入密码");
    return;
  }
  isLoggedIn.value = true;
  localStorage.setItem("adminToken", password.value.trim());
  fetchData();
};

const logout = () => {
  isLoggedIn.value = false;
  password.value = "";
  localStorage.removeItem("adminToken");
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("adminToken") || password.value;
  return { "x-admin-token": token };
};

const fetchConfig = async () => {
  try {
    const res = await $fetch<DrawConfig>("/api/admin/draw-config", {
      headers: getAuthHeaders(),
    });
    config.value = res;

    const drawAt = new Date(res.drawAt);
    const expireAt = new Date(res.ticketExpireAt);

    configForm.value = {
      drawAt: drawAt.toISOString().slice(0, 10),
      drawAtTime: drawAt.toTimeString().slice(0, 5),
      ticketExpireAt: expireAt.toISOString().slice(0, 10),
      ticketExpireAtTime: expireAt.toTimeString().slice(0, 5),
      winnerCount: String(res.winnerCount),
    };

    currentDate.value = [
      String(drawAt.getFullYear()),
      String(drawAt.getMonth() + 1).padStart(2, "0"),
      String(drawAt.getDate()).padStart(2, "0"),
    ];
    currentTime.value = [
      String(drawAt.getHours()).padStart(2, "0"),
      String(drawAt.getMinutes()).padStart(2, "0"),
    ];
    expireDate.value = [
      String(expireAt.getFullYear()),
      String(expireAt.getMonth() + 1).padStart(2, "0"),
      String(expireAt.getDate()).padStart(2, "0"),
    ];
    expireTime.value = [
      String(expireAt.getHours()).padStart(2, "0"),
      String(expireAt.getMinutes()).padStart(2, "0"),
    ];
  } catch (e: any) {
    if (e.response?.status === 401) {
      showToast("密码错误");
      logout();
    } else {
      showToast("获取配置失败");
    }
  }
};

const fetchParticipants = async () => {
  try {
    const res = await $fetch<Participant[]>("/api/admin/participants", {
      headers: getAuthHeaders(),
    });
    participants.value = res;
  } catch (e: any) {
    if (e.response?.status === 401) {
      showToast("密码错误");
      logout();
    }
  }
};

const fetchWinners = async () => {
  try {
    const res = await $fetch<Winner[]>("/api/admin/winners", {
      headers: getAuthHeaders(),
    });
    winners.value = res;
  } catch (e: any) {
    showToast("获取中奖者失败");
  }
};

const fetchData = async () => {
  loading.value = true;
  await Promise.all([fetchConfig(), fetchParticipants()]);
  loading.value = false;
};

const updateConfig = async () => {
  try {
    const drawAtStr = `${formatDate(currentDate.value)}T${formatTime(currentTime.value)}:00`;
    const expireAtStr = `${formatDate(expireDate.value)}T${formatTime(expireTime.value)}:00`;

    const selectedDrawAt = new Date(drawAtStr);
    const selectedExpireAt = new Date(expireAtStr);

    if (selectedDrawAt < now) {
      showToast("开奖时间不能早于当前时间");
      return;
    }

    if (selectedExpireAt <= selectedDrawAt) {
      showToast("门票过期时间必须晚于开奖时间");
      return;
    }

    await $fetch("/api/admin/draw-config", {
      method: "POST",
      headers: getAuthHeaders(),
      body: {
        drawAt: selectedDrawAt.toISOString(),
        ticketExpireAt: selectedExpireAt.toISOString(),
        winnerCount: parseInt(configForm.value.winnerCount, 10) || 10,
      },
    });
    showSuccessToast("保存成功");
    fetchConfig();
  } catch (e: any) {
    showToast(e.data?.statusMessage || "保存失败");
  }
};

const togglePublish = async (value: boolean) => {
  try {
    await $fetch("/api/admin/draw-config", {
      method: "POST",
      headers: getAuthHeaders(),
      body: {
        drawAt: config.value!.drawAt,
        ticketExpireAt: config.value!.ticketExpireAt,
        winnerCount: config.value!.winnerCount,
        publishStatus: value ? "PUBLIC" : "HIDDEN",
      },
    });
    showSuccessToast(value ? "已公开结果" : "已隐藏结果");
    fetchConfig();
  } catch (e: any) {
    showToast("操作失败");
    fetchConfig();
  }
};

const runDraw = async () => {
  try {
    await showConfirmDialog({
      title: "确认开奖",
      message: "确定要执行开奖吗？此操作不可撤销。",
    });
    const res = await $fetch<{ ok: boolean; winnerCount: number }>(
      "/api/admin/draw",
      {
        method: "POST",
        headers: getAuthHeaders(),
      }
    );
    showSuccessToast(`开奖成功，共 ${res.winnerCount} 人中奖`);
    fetchData();
  } catch (e: any) {
    if (e.message !== "cancel") {
      showToast(e.data?.statusMessage || "开奖失败");
    }
  }
};

const deleteResult = async () => {
  try {
    await showConfirmDialog({
      title: "删除抽奖结果",
      message: "删除后将清除所有抽奖结果和门票，参与者保留。确定删除？",
    });
    await $fetch("/api/admin/draw-result", {
      method: "POST",
      headers: getAuthHeaders(),
    });
    showSuccessToast("已删除抽奖结果");
    fetchData();
  } catch (e: any) {
    if (e.message !== "cancel") {
      showToast("删除失败");
    }
  }
};

const resetActivity = async () => {
  try {
    await showConfirmDialog({
      title: "确认重置",
      message: "重置将删除所有参与者数据和抽奖结果，此操作不可撤销！",
    });
    await $fetch("/api/admin/reset", {
      method: "POST",
      headers: getAuthHeaders(),
    });
    showSuccessToast("重置成功");
    fetchData();
  } catch (e: any) {
    if (e.message !== "cancel") {
      showToast("重置失败");
    }
  }
};

const goToScanner = () => {
  navigateTo("/admin/scan");
};

const openWinnersModal = async () => {
  await fetchWinners();
  showWinnersModal.value = true;
};

const toggleExpand = (id: string) => {
  expandedParticipant.value = expandedParticipant.value === id ? null : id;
};

const onDateConfirm = (values: { selectedValues: string[] }) => {
  currentDate.value = values.selectedValues;
  configForm.value.drawAt = formatDate(values.selectedValues);
  showDatePicker.value = false;
};

const onTimeConfirm = (values: { selectedValues: string[] }) => {
  currentTime.value = values.selectedValues;
  configForm.value.drawAtTime = formatTime(values.selectedValues);
  showTimePicker.value = false;
};

const onExpireDateConfirm = (values: { selectedValues: string[] }) => {
  expireDate.value = values.selectedValues;
  configForm.value.ticketExpireAt = formatDate(values.selectedValues);
  showExpirePicker.value = false;
};

const onExpireTimeConfirm = (values: { selectedValues: string[] }) => {
  expireTime.value = values.selectedValues;
  configForm.value.ticketExpireAtTime = formatTime(values.selectedValues);
  showExpireTimePicker.value = false;
};

onMounted(() => {
  const savedToken = localStorage.getItem("adminToken");
  if (savedToken) {
    password.value = savedToken;
    isLoggedIn.value = true;
    fetchData();
  }
});
</script>

<template>
  <div class="admin-page">
    <div v-if="!isLoggedIn" class="login-container">
      <van-cell-group inset>
        <van-field
          v-model="password"
          type="password"
          label="管理员密码"
          placeholder="请输入密码"
          @keyup.enter="handleLogin"
        />
      </van-cell-group>
      <van-button type="primary" block round @click="handleLogin">
        登录
      </van-button>
    </div>

    <template v-else>
      <van-nav-bar title="管理后台" right-text="退出" @click-right="logout" />

      <van-loading v-if="loading" class="page-loading" size="24px">
        加载中...
      </van-loading>

      <div v-else class="dashboard">
        <div class="cards-grid">
          <div class="admin-card">
            <div class="card-header">
              <van-icon name="gift-o" />
              <span>抽奖状态</span>
            </div>
            <div class="card-body">
              <div class="status-row">
                <span class="status-label">抽奖状态</span>
                <van-tag :type="config?.drawStatus === 'DONE' ? 'success' : 'primary'">
                  {{ drawStatusText }}
                </van-tag>
              </div>
              <div class="status-row">
                <span class="status-label">结果公开</span>
                <van-switch
                  :model-value="config?.publishStatus === 'PUBLIC'"
                  :disabled="config?.drawStatus !== 'DONE'"
                  @change="togglePublish"
                />
              </div>
              <div class="action-btns">
                <van-button
                  v-if="config?.drawStatus !== 'DONE'"
                  type="primary"
                  size="small"
                  block
                  @click="runDraw"
                >
                  执行开奖
                </van-button>
                <template v-else>
                  <van-button type="primary" size="small" block @click="openWinnersModal">
                    查看中奖者
                  </van-button>
                  <van-button type="danger" size="small" block @click="deleteResult">
                    删除结果
                  </van-button>
                </template>
              </div>
            </div>
          </div>

          <div class="admin-card">
            <div class="card-header">
              <van-icon name="setting-o" />
              <span>抽奖配置</span>
            </div>
            <div class="card-body">
              <div class="form-item">
                <label>开奖时间</label>
                <div class="time-inputs">
                  <div class="input-btn" @click="showDatePicker = true">
                    {{ configForm.drawAt || "选择日期" }}
                  </div>
                  <div class="input-btn" @click="showTimePicker = true">
                    {{ configForm.drawAtTime || "选择时间" }}
                  </div>
                </div>
              </div>
              <div class="form-item">
                <label>门票过期</label>
                <div class="time-inputs">
                  <div class="input-btn" @click="showExpirePicker = true">
                    {{ configForm.ticketExpireAt || "选择日期" }}
                  </div>
                  <div class="input-btn" @click="showExpireTimePicker = true">
                    {{ configForm.ticketExpireAtTime || "选择时间" }}
                  </div>
                </div>
              </div>
              <div class="form-item">
                <label>中奖人数</label>
                <input
                  v-model="configForm.winnerCount"
                  type="number"
                  class="number-input"
                  min="1"
                />
              </div>
              <van-button type="primary" size="small" block @click="updateConfig">
                保存配置
              </van-button>
            </div>
          </div>

          <div class="admin-card">
            <div class="card-header">
              <van-icon name="friends-o" />
              <span>参与者管理</span>
              <span class="header-count">({{ participants.length }}人)</span>
            </div>
            <div class="card-body">
              <div class="stats-row">
                <div class="stat-item">
                  <span class="stat-value">{{ participants.length }}</span>
                  <span class="stat-label">总数</span>
                </div>
                <div class="stat-item pending">
                  <span class="stat-value">{{ pendingCount }}</span>
                  <span class="stat-label">待开奖</span>
                </div>
                <div class="stat-item win">
                  <span class="stat-value">{{ winnerCount }}</span>
                  <span class="stat-label">中奖</span>
                </div>
              </div>
              <van-button
                type="default"
                size="small"
                block
                @click="showParticipantsModal = true"
              >
                查看参与者列表
              </van-button>
            </div>
          </div>

          <div class="admin-card highlight" @click="goToScanner">
            <div class="card-header">
              <van-icon name="scan" />
              <span>扫码验票</span>
            </div>
            <div class="card-body center">
              <van-icon name="scan" class="big-icon" />
              <p>点击进入扫码验票界面</p>
            </div>
          </div>

          <div class="admin-card danger">
            <div class="card-header">
              <van-icon name="delete-o" />
              <span>重置活动</span>
            </div>
            <div class="card-body">
              <p class="warning-text">重置将删除所有参与者数据和抽奖结果</p>
              <van-button type="danger" size="small" block @click="resetActivity">
                重置活动
              </van-button>
            </div>
          </div>
        </div>
      </div>

      <van-popup v-model:show="showDatePicker" position="bottom" round>
        <van-date-picker
          v-model="currentDate"
          title="选择开奖日期"
          :min-date="minDate"
          @confirm="onDateConfirm"
          @cancel="showDatePicker = false"
        />
      </van-popup>

      <van-popup v-model:show="showTimePicker" position="bottom" round>
        <van-time-picker
          v-model="currentTime"
          title="选择开奖时间"
          @confirm="onTimeConfirm"
          @cancel="showTimePicker = false"
        />
      </van-popup>

      <van-popup v-model:show="showExpirePicker" position="bottom" round>
        <van-date-picker
          v-model="expireDate"
          title="选择过期日期"
          :min-date="minDate"
          @confirm="onExpireDateConfirm"
          @cancel="showExpirePicker = false"
        />
      </van-popup>

      <van-popup v-model:show="showExpireTimePicker" position="bottom" round>
        <van-time-picker
          v-model="expireTime"
          title="选择过期时间"
          @confirm="onExpireTimeConfirm"
          @cancel="showExpireTimePicker = false"
        />
      </van-popup>

      <van-popup
        v-model:show="showParticipantsModal"
        position="bottom"
        round
        :style="{ height: '80%' }"
      >
        <div class="modal-content">
          <div class="modal-header">
            <h3>参与者列表 ({{ participants.length }}人)</h3>
          </div>
          <div class="modal-body participant-list">
            <div
              v-for="p in participants"
              :key="p.id"
              class="participant-item"
              :class="{ expanded: expandedParticipant === p.id }"
            >
              <div class="item-main" @click="toggleExpand(p.id)">
                <div class="item-info">
                  <div class="item-name">{{ p.name }}</div>
                  <div class="item-school">{{ p.school }}</div>
                </div>
                <div class="item-right">
                  <van-tag v-if="p.drawResult === 'WIN'" type="success" size="medium">
                    中奖
                  </van-tag>
                  <van-tag v-else-if="p.drawResult === 'LOSE'" type="default" size="medium">
                    未中
                  </van-tag>
                  <van-tag v-else type="primary" size="medium">待开奖</van-tag>
                  <van-icon
                    :name="expandedParticipant === p.id ? 'arrow-up' : 'arrow-down'"
                    class="expand-icon"
                  />
                </div>
              </div>
              <div v-if="expandedParticipant === p.id" class="item-detail">
                <div class="detail-row">
                  <span class="detail-label">报名时间</span>
                  <span class="detail-value">{{ formatDateTime(p.createdAt) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">IP地址</span>
                  <span class="detail-value">{{ p.ip }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">浏览器</span>
                  <span class="detail-value ua">{{ p.userAgent }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">指纹</span>
                  <span class="detail-value fingerprint">{{ p.fingerprintHash }}</span>
                </div>
                <div v-if="p.ticket" class="detail-row">
                  <span class="detail-label">门票码</span>
                  <span class="detail-value">{{ formatTicketCode(p.ticket.ticketCode) }}</span>
                </div>
                <div v-if="p.ticket" class="detail-row">
                  <span class="detail-label">门票状态</span>
                  <van-tag
                    :type="p.ticket.status === 'VALID' ? 'success' : 'default'"
                  >
                    {{ p.ticket.status === 'VALID' ? '有效' : p.ticket.status === 'USED' ? '已使用' : '已过期' }}
                  </van-tag>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <van-button block round @click="showParticipantsModal = false">
              关闭
            </van-button>
          </div>
        </div>
      </van-popup>

      <van-popup
        v-model:show="showWinnersModal"
        position="bottom"
        round
        :style="{ height: '70%' }"
      >
        <div class="modal-content">
          <div class="modal-header">
            <h3>中奖者列表 ({{ winners.length }}人)</h3>
          </div>
          <div class="modal-body">
            <van-cell
              v-for="w in winners"
              :key="w.id"
              :title="w.name"
              :label="w.school"
            >
              <template #value>
                <van-tag v-if="w.ticket?.status === 'VALID'" type="success">
                  门票有效
                </van-tag>
                <van-tag v-else-if="w.ticket?.status === 'USED'" type="warning">
                  已使用
                </van-tag>
                <van-tag v-else type="default">已过期</van-tag>
              </template>
            </van-cell>
          </div>
          <div class="modal-footer">
            <van-button block round @click="showWinnersModal = false">
              关闭
            </van-button>
          </div>
        </div>
      </van-popup>
    </template>
  </div>
</template>

<style scoped lang="scss">
.admin-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.login-container {
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.dashboard {
  padding: 16px;
}

.cards-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  &.highlight {
    background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%);
    cursor: pointer;

    .card-header,
    .card-body {
      color: #fff;
    }

    .big-icon {
      color: #fff;
    }
  }

  &.danger {
    .card-header {
      color: #f44336;
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: #fafafa;
    font-size: 14px;
    font-weight: 500;
    color: #333;

    .header-count {
      font-size: 12px;
      font-weight: normal;
      color: #999;
    }
  }

  .card-body {
    padding: 16px;

    &.center {
      text-align: center;

      .big-icon {
        font-size: 48px;
        color: #fff;
        margin-bottom: 8px;
      }

      p {
        margin: 0;
        font-size: 12px;
        opacity: 0.8;
      }
    }
  }
}

.form-item {
  margin-bottom: 12px;

  label {
    display: block;
    font-size: 12px;
    color: #666;
    margin-bottom: 6px;
  }

  .time-inputs {
    display: flex;
    gap: 8px;

    .input-btn {
      flex: 1;
      padding: 8px 12px;
      background: #f5f5f5;
      border-radius: 6px;
      font-size: 13px;
      text-align: center;
      cursor: pointer;
    }
  }

  .number-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    box-sizing: border-box;

    &:focus {
      border-color: #1976d2;
    }
  }
}

.stats-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;

  .stat-item {
    flex: 1;
    text-align: center;
    padding: 8px;
    background: #f5f5f5;
    border-radius: 6px;

    .stat-value {
      display: block;
      font-size: 20px;
      font-weight: bold;
      color: #333;
    }

    .stat-label {
      font-size: 11px;
      color: #999;
    }

    &.pending .stat-value {
      color: #1976d2;
    }

    &.win .stat-value {
      color: #4caf50;
    }
  }
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  .status-label {
    font-size: 14px;
    color: #666;
  }
}

.action-btns {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warning-text {
  font-size: 12px;
  color: #999;
  margin-bottom: 12px;
}

.modal-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid #eee;

  h3 {
    margin: 0;
    font-size: 18px;
    color: #333;
  }
}

.modal-body {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

.modal-footer {
  padding: 16px;
  border-top: 1px solid #eee;
}

.participant-list {
  padding: 0;
}

.participant-item {
  background: #fff;
  border-radius: 12px;
  margin-bottom: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  &.expanded {
    .item-main {
      border-bottom: 1px solid #eee;
    }
  }

  .item-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    cursor: pointer;

    .item-info {
      .item-name {
        font-size: 15px;
        font-weight: 500;
        color: #333;
      }

      .item-school {
        font-size: 12px;
        color: #999;
        margin-top: 4px;
      }
    }

    .item-right {
      display: flex;
      align-items: center;
      gap: 8px;

      .expand-icon {
        color: #999;
        font-size: 14px;
      }
    }
  }

  .item-detail {
    padding: 14px 16px;
    background: #fafafa;

    .detail-row {
      display: flex;
      align-items: flex-start;
      margin-bottom: 10px;

      &:last-child {
        margin-bottom: 0;
      }

      .detail-label {
        width: 80px;
        font-size: 12px;
        color: #999;
        flex-shrink: 0;
      }

      .detail-value {
        font-size: 12px;
        color: #333;
        word-break: break-all;

        &.ua {
          font-size: 11px;
          color: #666;
        }

        &.fingerprint {
          font-family: monospace;
          font-size: 10px;
        }
      }
    }
  }
}
</style>
