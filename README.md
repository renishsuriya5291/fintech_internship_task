
# Fintech Platform

## Overview
This project is a basic fintech platform that allows users to manage their accounts and perform simple transactions like deposits and withdrawals.

## Technology Stack
- Node.js
- Hasura (GraphQL API)
- HTML/CSS/JavaScript (Frontend)

## Setup Instructions

### Backend Setup

1. **Clone the Repository**:
    ```bash
    git clone <repository_url>
    cd fintech-platform
    ```

2. **Set Up PostgreSQL Database**:
    - Set up a PostgreSQL database using a cloud provider or a local instance.
    - Create the necessary tables (`users` and `transactions`).

    ```sql
    -- Users Table
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      balance NUMERIC DEFAULT 0
    );

    -- Transactions Table
    CREATE TABLE transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      type TEXT CHECK (type IN ('deposit', 'withdrawal')) NOT NULL,
      amount NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    ```

3. **Deploy Hasura**:
    - Deploy Hasura and connect it to your PostgreSQL database.
    - Use the Hasura console to set up the GraphQL API.

4. **Set Environment Variables**:
    - Set the `HASURA_URL` and `HASURA_ADMIN_SECRET` environment variables in your `.env` file.

5. **Run the Node.js Server**:
    ```bash
    npm install
    node server.js
    ```

### Frontend Setup

1. Open `index.html` in a web browser.
2. Update the `userId` variable in the script to match the user ID in your database.

## API Documentation

### Deposit API
- **Endpoint**: `/deposit`
- **Method**: POST
- **Request Body**: `{ "userId": 1, "amount": 100 }`
- **Response**: `{ "data": { "update_users_by_pk": { "id": 1, "balance": 100 } } }`

### Withdraw API
- **Endpoint**: `/withdraw`
- **Method**: POST
- **Request Body**: `{ "userId": 1, "amount": 50 }`
- **Response**: `{ "data": { "update_users_by_pk": { "id": 1, "balance": 50 } } }`

## Design Decisions and Assumptions
- **User Authentication**: This example assumes a single user (user ID 1). In a real application, you would implement user authentication and authorization.
- **Error Handling**: Basic error handling is included. In a real application, you would add more comprehensive error handling and validation.
- **Scalability**: The code is organized to be easily scalable. You can add more features and functionalities as needed.
    