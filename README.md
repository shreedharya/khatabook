# Khata Book

A local customer ledger for Indian shopkeepers. The website uses HTML, CSS, and browser JavaScript. Express runs the backend API, and a JSON file stores your customers and transactions on this computer.

## 1. Node.js and npm

This project has a local copy of Node.js 24 LTS and npm in `.tools`. It does not change your Windows-wide PATH and does not need administrator permission.

## 2. Install the app dependency

Express is already installed. If you need to install it again, open PowerShell in this project folder and run:

```powershell
cd "C:\Users\DVLAB2-STUDENT\Documents\workshop2\khata-book"
npm.cmd install
```

## 3. Start the website

Double-click `start.bat` in this folder, or run:
```powershell
cd "C:\Users\DVLAB2-STUDENT\Documents\workshop2\khata-book"
$env:Path = "$PWD\.tools\node-v24.21.0-win-x64;$env:Path"
npm start
```

Keep the terminal open. In Chrome or Edge, visit **http://127.0.0.1:3000**. Do not double-click `public\index.html`; opening that file directly bypasses Express and the saved-data API. Press **Ctrl+C** in the terminal to stop the server.

## 4. Use the ledger

1. Select **Add customer**, enter their name and (optionally) phone number, then save.
2. Select **＋ Entry** beside a customer.
3. Choose **Credit** when the customer takes goods and will pay later. This increases what they owe.
4. Choose **Payment** when the customer pays you. This reduces what they owe; an overpayment appears as a customer advance.
5. Select **Ledger** to see the most recent 200 entries for that customer. Search customers by name or phone.
6. Select **Open SMS** to ask your computer to open a compatible SMS app with the number and message ready. If desktop SMS is not configured, use **Copy message** and paste the text into Phone Link or another messaging app connected to your phone.
7. Select **Send SMS** to submit the current balance through MSG91. Before using it, follow the MSG91 setup below. The server reports when MSG91 accepts the request; check MSG91 delivery logs for final delivery status.

## 5. Set up automatic SMS with MSG91

The MSG91 API integration is already included in this project; there is no separate SMS API package to install. Automatic SMS requires an MSG91 account with SMS credits, an active Flow template, and for Indian numbers an approved DLT sender/template. MSG91 controls approval, pricing, and final delivery. See the [MSG91 SMS API documentation](https://docs.msg91.com/sms/send-sms) and its [SMS setup guide](https://msg91.com/help/MSG91/step-by-step-process-to-configure-sms).

1. Create and verify an account in [MSG91](https://control.msg91.com/signin/).
2. In MSG91, configure your sender ID and DLT registration for India.
3. Create and activate an SMS Flow whose approved message has two variables: the customer name and the balance sentence. The variable keys used by this app default to `VAR1` and `VAR2`. The Flow's approved wording and sender must comply with your DLT approval.
4. In the Khata Book page, select **SMS settings**. Enter your MSG91 auth key, active Flow template ID, and the variable names used by your approved template, then select **Save settings**. The key is saved privately in the local `.env` file and is never returned to the browser. It can also be configured through `.env` if you prefer.
5. Select **Send SMS** on a customer. This makes a paid request to MSG91. Use a test number and check MSG91 logs before sending to customers.

The MSG91 integration uses Node.js's built-in `fetch`; no separate SMS SDK or extra npm package is required. The auth key stays on the server and is never sent to the browser. The **Open SMS** and **Copy message** options remain available for manual sending.

## 6. Run the tests

Open another terminal in this folder and run:

```powershell
$env:Path = "$PWD\.tools\node-v24.21.0-win-x64;$env:Path"
npm.cmd test
```

Tests cover serving the website, credit and payment balance calculations, transaction history, saved data, advances, and invalid amounts.

## Project files

- `package.json` — app metadata, Express dependency, and start/test commands.
- `server.js` — Express server, web routes, API routes, and input validation.
- `src/store.js` — persistent storage and balance calculation.
- `public/index.html` — page structure and forms.
- `public/styles.css` — desktop and mobile-friendly layout and styling.
- `public/app.js` — browser interactions, API requests, ledger display, and prepared SMS links.
- `test/api.test.js` — backend tests.
- `src/msg91.js` — sends balance messages through the MSG91 Flow API.
- The **SMS settings** button in the website configures MSG91 without needing a terminal or text editor.
- `.env.example` — example names for local MSG91 settings; copy it to `.env` and use your own credentials.
- `start.bat` — starts the server with this project's local Node.js copy.
- `.tools/` — local Node.js and npm files; no system-wide installation is needed.
- `data/khata.json` — created automatically when a record is saved; back it up to preserve your records.

This starter is for one shop using a local computer. It does not include online hosting or user accounts. Automatic SMS works only after you configure your MSG91 account, approved template, and DLT settings.
