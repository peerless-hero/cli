import process from 'node:process'

// 在 dotenv/config 加载之前，先清除可能从 .env 文件中读取的环境变量，
// 直接操作 process.env 以确保 dotenv 不会覆盖（dotenv 默认不覆盖已存在的变量）
const envVarsToClear = [
  'PACKAGE_SCOPE',
  'PACKAGE_UN_NAME',
  'PACKAGE_AXIOS_NAME',
  'PACKAGE_OPENAPI_V3_NAME',
  'APIFOX_TOKEN',
  'APIFOX_PROJECT_ID',
  'OLD_APIFOX_PROJECT_ID',
  'OLD_OPENAPI_DATASOURCE',
  'OLD_OPENAPI_APIFOX_PROJECT_ID',
  'OPENAPI_HOST',
  'OPENAPI_DATASOURCE',
  'GLOBAL_OPENAPI_PATH',
  'VITE_OPENAPI_URL',
  'SKIP_LATEST_VERSION',
  'INITIAL_VERSION',
  'WEBHOOK_WECOM_KEY',
  'WEBHOOK_DINGTALK_KEY',
  'CHANGELOG_OUTPUT_DIR',
  'MAX_PATCH_VERSION',
]

for (const key of envVarsToClear) {
  process.env[key] = ''
}
