/** 支付宝 uni transfer 参数格式实验（0.01 元真实网关探测；签约未生效不会扣款） */
const fs = require('fs');
const path = require('path');
const AlipaySdkModule = require('alipay-sdk');
const AlipaySdk = AlipaySdkModule.AlipaySdk || AlipaySdkModule.default || AlipaySdkModule;

const certDir = path.join(__dirname, 'certs');
const readCert = (n) => fs.readFileSync(path.join(certDir, n + '.pem'), 'utf8').trim();
const APP_ID = '2021005110624338';
const PRIVATE_KEY = readCert('app_private_key');
const APP_CERT = readCert('app_cert');
const ALIPAY_CERT = readCert('alipay_cert');
const ROOT_CERT = readCert('root_cert');

const sdk = new AlipaySdk({
  appId: APP_ID,
  keyType: 'PKCS8',
  privateKey: PRIVATE_KEY,
  gateway: 'https://openapi.alipay.com/gateway.do',
  signType: 'RSA2',
  timeout: 15000,
  appCertContent: APP_CERT,
  alipayPublicCertContent: ALIPAY_CERT,
  alipayRootCertContent: ROOT_CERT,
});

function run(name, bizContent) {
  return sdk.exec('alipay.fund.trans.uni.transfer', { bizContent })
    .then(r => {
      const code = r && (r.code || r.errorCode);
      console.log(`\n### ${name} -> code=${code} subCode=${(r && (r.subCode||r.sub_code))||''} subMsg=${(r && (r.subMsg||r.sub_msg))||''} msg=${(r && r.msg)||''}`);
      return r;
    })
    .catch(e => console.log(`\n### ${name} -> EXCEPTION: ${(e && e.message)||e}`));
}

(async () => {
  const common = { product_code: 'TRANS_ACCOUNT_NO_PWD', biz_scene: 'DIRECT_TRANSFER', trans_amount: '0.01' };

  // 1. name 对象 full_name（现状）
  await run('A:name-object', { ...common, out_biz_no: 'TESTA' + Date.now(), order_title: '测试', payee_info: { identity_type: 'ALIPAY_LOGON_ID', identity: '15291571201', name: { full_name: '刘莹' } } });

  // 2. name 字符串
  await run('B:name-string', { ...common, out_biz_no: 'TESTB' + Date.now(), order_title: '测试', payee_info: { identity_type: 'ALIPAY_LOGON_ID', identity: '15291571201', name: '刘莹' } });

  // 3. 无 order_title
  await run('C:no-title', { ...common, out_biz_no: 'TESTC' + Date.now(), payee_info: { identity_type: 'ALIPAY_LOGON_ID', identity: '15291571201', name: { full_name: '刘莹' } } });

  // 4. 加 remark + name 字符串
  await run('D:remark-name-string', { ...common, out_biz_no: 'TESTD' + Date.now(), order_title: '测试', remark: '备注', payee_info: { identity_type: 'ALIPAY_LOGON_ID', identity: '15291571201', name: '刘莹' } });

  // 5. ALIPAY_USER_ID + name 对象
  await run('E:uid-name-object', { ...common, out_biz_no: 'TESTE' + Date.now(), order_title: '测试', payee_info: { identity_type: 'ALIPAY_USER_ID', identity: '2088941781434485', name: { full_name: '刘莹' } } });

  // 6. 只 identity 手机号 + name 对象（无 identity_type 大写？用小写）
  await run('F:lowercase', { ...common, out_biz_no: 'TESTF' + Date.now(), order_title: '测试', payee_info: { identity_type: 'ALIPAY_LOGON_ID', identity: '15291571201', name: { full_name: '刘莹' } } });
})();
