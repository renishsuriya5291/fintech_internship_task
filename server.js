const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(bodyParser.json());
app.use(cors());

// Environment variables for Hasura connection
const HASURA_URL = process.env.HASURA_URL;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;

// Helper function to interact with Hasura GraphQL API
const hasuraRequest = async (query, variables) => {
  try {
    const response = await axios.post(
      HASURA_URL,
      { query, variables },
      {
        headers: {
          'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
        },
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(`Hasura request failed: ${error.message}`);
  }
};

// Route to handle deposits
app.post('/deposit', async (req, res) => {
  const { userId, amount } = req.body;
  const depositQuery = `
    mutation($userId: Int!, $amount: numeric!) {
      update_users_by_pk(pk_columns: {id: $userId}, _inc: {balance: $amount}) {
        id
        balance
      }
      insert_transactions(objects: {user_id: $userId, type: "deposit", amount: $amount}) {
        returning {
          id
        }
      }
    }
  `;
  try {
    const result = await hasuraRequest(depositQuery, { userId, amount });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to handle withdrawals
app.post('/withdraw', async (req, res) => {
  const { userId, amount } = req.body;

  // Query to check user's current balance
  const checkBalanceQuery = `
    query($userId: Int!) {
      users_by_pk(id: $userId) {
        balance
      }
    }
  `;

  try {
    // Fetch current balance
    const balanceResult = await hasuraRequest(checkBalanceQuery, { userId });
    const currentBalance = balanceResult.data.users_by_pk.balance;

    // Check if balance is sufficient for withdrawal
    if (currentBalance < amount) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    const finalBalance = currentBalance - amount;

    // Proceed with withdrawal
    const withdrawQuery = `
      mutation($userId: Int!, $amount: numeric!, $finalBalance: numeric!) {
        update_users_by_pk(pk_columns: {id: $userId}, _set: {balance: $finalBalance}) {
          id
          balance
        }
        insert_transactions(objects: {user_id: $userId, type: "withdrawal", amount: $amount}) {
          returning {
            id
          }
        }
      }
    `;
    const result = await hasuraRequest(withdrawQuery, { userId, amount, finalBalance });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route for handling GraphQL queries
app.post('/graphql', async (req, res) => {
  const { query } = req.body;
  try {
    const result = await hasuraRequest(query, {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
