#!/usr/bin/env node
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testJiraConnection() {
  const { JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

  if (!JIRA_HOST || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error('Missing required environment variables!');
    console.error('Please copy .env.example to .env and fill in your Jira credentials.');
    process.exit(1);
  }

  console.log(`Testing connection to ${JIRA_HOST}...`);

  try {
    const response = await axios.get(`https://${JIRA_HOST}/rest/api/2/myself`, {
      auth: {
        username: JIRA_EMAIL,
        password: JIRA_API_TOKEN,
      },
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('✅ Connection successful!');
    console.log(`Connected as: ${response.data.displayName} (${response.data.emailAddress})`);
  } catch (error) {
    console.error('❌ Connection failed!');
    if (error.response?.status === 401) {
      console.error('Authentication failed. Please check your credentials.');
    } else {
      console.error('Error:', error.message);
    }
  }
}

testJiraConnection();