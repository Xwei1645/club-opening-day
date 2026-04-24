import { defineNuxtPlugin } from "#app";
import {
  Button,
  Card,
  Cell,
  CellGroup,
  DatePicker,
  Dialog,
  Divider,
  Field,
  Icon,
  Loading,
  NavBar,
  Popup,
  Search,
  Switch,
  Tab,
  Tabs,
  Tag,
  TimePicker,
  Radio,
  RadioGroup,
  showToast,
  showSuccessToast,
  showConfirmDialog,
} from "vant";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Button);
  nuxtApp.vueApp.use(Card);
  nuxtApp.vueApp.use(Cell);
  nuxtApp.vueApp.use(CellGroup);
  nuxtApp.vueApp.use(DatePicker);
  nuxtApp.vueApp.use(Dialog);
  nuxtApp.vueApp.use(Divider);
  nuxtApp.vueApp.use(Field);
  nuxtApp.vueApp.use(Icon);
  nuxtApp.vueApp.use(Loading);
  nuxtApp.vueApp.use(NavBar);
  nuxtApp.vueApp.use(Popup);
  nuxtApp.vueApp.use(Search);
  nuxtApp.vueApp.use(Switch);
  nuxtApp.vueApp.use(Tab);
  nuxtApp.vueApp.use(Tabs);
  nuxtApp.vueApp.use(Tag);
  nuxtApp.vueApp.use(TimePicker);
  nuxtApp.vueApp.use(Radio);
  nuxtApp.vueApp.use(RadioGroup);
});

export { showToast, showSuccessToast, showConfirmDialog };
