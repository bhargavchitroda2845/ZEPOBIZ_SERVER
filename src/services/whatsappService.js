const axios = require('axios');

const sendMessage = async (account, recipientPhone, messageText) => {
  try {
    if (!account) {
      throw new Error('WhatsApp Account missing');
    }

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${account.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: recipientPhone,
        text: { 
          body: messageText 
        }
      },
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;

  } catch (error) {
    if (error.response?.data?.error?.code === 190) {
      console.error("❌ WHATSAPP AUTH ERROR: Your Access Token has expired! Please update it in Bot Settings.");
    } else {
      console.error('WhatsApp Send Error:', error.response?.data || error.message);
    }
    throw error;
  }
};

const uploadMedia = async (account, filePath, fileName) => {
  try {
    const fs = require('fs');
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('type', 'application/pdf');
    form.append('messaging_product', 'whatsapp');

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${account.phoneNumberId}/media`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${account.accessToken}`,
        },
      }
    );
    return response.data.id;
  } catch (error) {
    console.error('WhatsApp Media Upload Error:', error.response?.data || error.message);
    throw error;
  }
};

const sendDocument = async (account, recipientPhone, mediaId, fileName) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${account.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: recipientPhone,
        type: 'document',
        document: {
          id: mediaId,
          filename: fileName
        }
      },
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('WhatsApp Document Send Error:', error.response?.data || error.message);
    throw error;
  }
};


const downloadMedia = async (account, mediaId) => {
  try {
    const urlResponse = await axios.get(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${account.accessToken}` }
      }
    );

    const mediaUrl = urlResponse.data.url;

    const mediaResponse = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
      responseType: 'arraybuffer'
    });

    const base64 = Buffer.from(mediaResponse.data, 'binary').toString('base64');
    const mimeType = mediaResponse.headers['content-type'];

    return { base64, mimeType };
  } catch (error) {
    console.error('WhatsApp Media Download Error:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = { sendMessage, sendDocument, downloadMedia, uploadMedia };

