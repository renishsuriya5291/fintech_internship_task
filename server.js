const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const app = express();
const PORT = process.env.PORT || 5000;

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

app.post('/transfer', async (req, res) => {
  const { fromUserId, toUserId, amount } = req.body;

  if (!fromUserId || !toUserId || !amount) {
    return res.status(400).json({ error: 'Please provide fromUserId, toUserId, and amount' });
  }

  if (fromUserId === toUserId) {
    return res.status(400).json({ error: 'Transfer to the same account is not allowed' });
  }

  // Query to check the user's current balance
  const checkBalanceQuery = `
    query($userId: Int!) {
      users_by_pk(id: $userId) {
        balance
      }
    }
  `;

  // Mutation to update sender's balance
  const updateSenderMutation = `
    mutation($userId: Int!, $newBalance: numeric!) {
      update_users_by_pk(pk_columns: {id: $userId}, _set: {balance: $newBalance}) {
        id
        balance
      }
    }
  `;

  // Mutation to update recipient's balance
  const updateRecipientMutation = `
    mutation($userId: Int!, $newBalance: numeric!) {
      update_users_by_pk(pk_columns: {id: $userId}, _set: {balance: $newBalance}) {
        id
        balance
      }
    }
  `;

  try {
    // Fetch sender's current balance
    const senderBalanceResult = await hasuraRequest(checkBalanceQuery, { userId: fromUserId });
    const senderData = senderBalanceResult.data.users_by_pk;

    if (!senderData) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    const currentBalance = senderData.balance;

    // Check if balance is sufficient for transfer
    if (currentBalance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    const senderFinalBalance = currentBalance - amount;

    // Fetch recipient's current balance
    const recipientBalanceResult = await hasuraRequest(checkBalanceQuery, { userId: toUserId });
    const recipientData = recipientBalanceResult.data.users_by_pk;

    if (!recipientData) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const recipientCurrentBalance = recipientData.balance;
    const recipientFinalBalance = recipientCurrentBalance + amount;

    // Proceed with updates
    await hasuraRequest(updateSenderMutation, { userId: fromUserId, newBalance: senderFinalBalance });
    await hasuraRequest(updateRecipientMutation, { userId: toUserId, newBalance: recipientFinalBalance });

    res.json({ message: 'Transfer successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});




// AuthenticateJWT
const authenticateJWT = (req, res, next) => {
  const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Route for user signup
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  const signupQuery = `
    mutation($name: String!, $email: String!, $password: String!) {
      insert_users_one(object: {name: $name, email: $email, password: $password, balance: 0}) {
        id
        name
        email
      }
    }
  `;
  try {
    const result = await hasuraRequest(signupQuery, { name, email, password: hashedPassword });
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route for user login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const userQuery = `
    query($email: String!) {
      users(where: {email: {_eq: $email}}) {
        id
        name
        email
        password
      }
    }
  `;
  try {
    const result = await hasuraRequest(userQuery, { email });
    const user = result.data.users[0];
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});





// Route for user signup
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  const signupQuery = `
    mutation($username: String!, $password: String!) {
      insert_users_one(object: {username: $username, password: $password}) {
        id
        username
      }
    }
  `;
  try {
    const result = await hasuraRequest(signupQuery, { username, password: hashedPassword });
    res.status(201).json(result);
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

// Route to fetch user info
app.get('/user', authenticateJWT, async (req, res) => {
  const { id } = req.user;
  const userQuery = `
    query($id: Int!) {
      users_by_pk(id: $id) {
        name
        email
      }
    }
  `;
  try {
    const result = await hasuraRequest(userQuery, { id });
    res.json(result.data.users_by_pk);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/user', authenticateJWT, async (req, res) => {
  const { name } = req.body;
  const { id } = req.user;
  const updateQuery = `
    mutation($id: Int!, $name: String!) {
      update_users_by_pk(pk_columns: {id: $id}, _set: {name: $name}) {
        id
        name
      }
    }
  `;
  try {
    const result = await hasuraRequest(updateQuery, { id, name });
    res.json(result.data.update_users_by_pk);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Route for handling GraphQL queries
app.post('/graphql', async (req, res) => {
  const { query, variables } = req.body;
  try {
    const result = await hasuraRequest(query, variables);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
