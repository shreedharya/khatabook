"use strict";

const path = require("node:path");
const fs = require("node:fs/promises");
const express = require("express");
const { createStore } = require("./src/store");
const { createMsg91Client } = require("./src/msg91");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = process.env.KHATA_DATA_FILE || path.join(__dirname, "data", "khata.json");
const MAX_AMOUNT_PAISE = 99_999_999_999;

try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

function parseAmountToPaise(amount) {
  if (typeof amount !== "string" || !/^\d{1,9}(?:\.\d{1,2})?$/.test(amount)) return null;
  const [rupees, paise = ""] = amount.split(".");
  const value = Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_AMOUNT_PAISE ? value : null;
}

function parseCustomerId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function createApp(
  store = createStore(DATA_FILE),
  smsClient = createMsg91Client(),
  settingsFile = path.join(__dirname, ".env")
) {
  const app = express();
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/settings/msg91", (request, response) => {
    response.json(smsClient.getPublicSettings());
  });

  app.post("/api/settings/msg91", async (request, response, next) => {
    const {
      authKey = "",
      templateId,
      nameVariable = "VAR1",
      balanceVariable = "VAR2"
    } = request.body || {};
    if (typeof authKey !== "string" || authKey.trim().length > 256 || /[\r\n]/.test(authKey)) {
      response.status(400).json({ error: "Enter a valid MSG91 auth key." });
      return;
    }
    if (typeof templateId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(templateId.trim())) {
      response.status(400).json({ error: "Enter the approved MSG91 Flow template ID." });
      return;
    }
    const validVariable = value => typeof value === "string" && /^[A-Z][A-Z0-9_]{0,39}$/.test(value);
    if (
      !validVariable(nameVariable) ||
      !validVariable(balanceVariable) ||
      nameVariable === balanceVariable ||
      nameVariable === "MOBILES" ||
      balanceVariable === "MOBILES"
    ) {
      response.status(400).json({ error: "Use two different MSG91 variable names, such as VAR1 and VAR2." });
      return;
    }

    const effectiveAuthKey = authKey.trim() || process.env.MSG91_AUTH_KEY || "";
    if (!effectiveAuthKey) {
      response.status(400).json({ error: "Enter your MSG91 auth key." });
      return;
    }

    try {
      const settings = {
        authKey: effectiveAuthKey,
        templateId: templateId.trim(),
        nameVariable,
        balanceVariable
      };
      const contents = [
        `MSG91_AUTH_KEY=${JSON.stringify(settings.authKey)}`,
        `MSG91_TEMPLATE_ID=${JSON.stringify(settings.templateId)}`,
        `MSG91_NAME_VARIABLE=${JSON.stringify(settings.nameVariable)}`,
        `MSG91_BALANCE_VARIABLE=${JSON.stringify(settings.balanceVariable)}`,
        ""
      ].join("\n");
      await fs.mkdir(path.dirname(settingsFile), { recursive: true });
      const temporaryFile = `${settingsFile}.${process.pid}.tmp`;
      await fs.writeFile(temporaryFile, contents, { encoding: "utf8", mode: 0o600 });
      await fs.rename(temporaryFile, settingsFile);
      smsClient.configure(settings);
      response.json({ ok: true, settings: smsClient.getPublicSettings() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/customers", async (request, response, next) => {
    try {
      response.json({ customers: await store.getCustomers() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/summary", async (request, response, next) => {
    try {
      response.json(await store.getSummary());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/customers", async (request, response, next) => {
    const { name, phone = "" } = request.body || {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      response.status(400).json({ error: "Enter a customer name (up to 100 characters)." });
      return;
    }
    if (
      typeof phone !== "string" ||
      phone.trim().length > 30 ||
      (phone.trim() && !/^\+?[\d\s().-]+$/.test(phone.trim())) ||
      (phone.trim() &&
        (phone.replace(/\D/g, "").length < 7 || phone.replace(/\D/g, "").length > 15))
    ) {
      response.status(400).json({ error: "Enter a valid phone number or leave it blank." });
      return;
    }

    try {
      const customer = await store.createCustomer({ name: name.trim(), phone: phone.trim() });
      response.status(201).json({ customer });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/customers/:id/transactions", async (request, response, next) => {
    const customerId = parseCustomerId(request.params.id);
    if (!customerId) {
      response.status(400).json({ error: "Invalid customer ID." });
      return;
    }

    try {
      const transactions = await store.getTransactions(customerId);
      if (transactions === null) {
        response.status(404).json({ error: "Customer not found." });
        return;
      }
      response.json({ transactions });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/customers/:id/transactions", async (request, response, next) => {
    const customerId = parseCustomerId(request.params.id);
    if (!customerId) {
      response.status(400).json({ error: "Invalid customer ID." });
      return;
    }

    const { kind, amount, note = "" } = request.body || {};
    if (kind !== "credit" && kind !== "payment") {
      response.status(400).json({ error: "Choose credit or payment." });
      return;
    }
    const amountPaise = parseAmountToPaise(amount);
    if (amountPaise === null) {
      response.status(400).json({ error: "Enter an amount greater than zero with up to two decimal places." });
      return;
    }
    if (typeof note !== "string" || note.trim().length > 200) {
      response.status(400).json({ error: "Note must be 200 characters or fewer." });
      return;
    }

    try {
      const transaction = await store.createTransaction(customerId, {
        kind,
        amountPaise,
        note: note.trim()
      });
      if (transaction === null) {
        response.status(404).json({ error: "Customer not found." });
        return;
      }
      response.status(201).json({ transaction });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/customers/:id/send-sms", async (request, response, next) => {
    const customerId = parseCustomerId(request.params.id);
    if (!customerId) {
      response.status(400).json({ error: "Invalid customer ID." });
      return;
    }
    if (!smsClient.isConfigured()) {
      response.status(503).json({
        error: "SMS sending is not configured. Copy .env.example to .env, add your MSG91 settings, and restart the app."
      });
      return;
    }

    try {
      const customer = (await store.getCustomers()).find(item => item.id === customerId);
      if (!customer) {
        response.status(404).json({ error: "Customer not found." });
        return;
      }
      if (!customer.phone) {
        response.status(400).json({ error: "This customer does not have a mobile number." });
        return;
      }

      const balanceText = customer.balancePaise > 0
        ? `balance due is Rs. ${(customer.balancePaise / 100).toFixed(2)}`
        : customer.balancePaise < 0
          ? `advance balance is Rs. ${(Math.abs(customer.balancePaise) / 100).toFixed(2)}`
          : "balance is settled";
      await smsClient.sendBalanceMessage({
        phone: customer.phone,
        customerName: customer.name,
        balanceText
      });
      response.json({ ok: true, message: "MSG91 accepted the SMS request." });
    } catch (error) {
      if (error.message.startsWith("MSG91 ") || error.message.startsWith("Could not connect to MSG91")) {
        response.status(502).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  app.use("/api", (request, response) => {
    response.status(404).json({ error: "API route not found." });
  });

  app.use(express.static(path.join(__dirname, "public")));

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
      response.status(400).json({ error: "Request body must contain valid JSON." });
      return;
    }
    console.error(error);
    response.status(500).json({ error: "The app could not complete this request. Check the server terminal." });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`Khata Book is running at http://${HOST}:${PORT}`);
    console.log(`Customer data is saved in ${DATA_FILE}`);
  });
}

module.exports = { createApp, parseAmountToPaise };
