/// <reference lib="deno.ns" />
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestPayload {
  sectionId: string;
  fileUrls: string[];
  webhookUrl: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Parse and validate request body
    let payload: RequestPayload;
    try {
      payload = await req.json();
      
      // Detailed validation with specific error messages
      if (!payload) {
        throw new Error('Request body is empty');
      }
      if (!payload.sectionId) {
        throw new Error('sectionId is required');
      }
      if (!Array.isArray(payload.fileUrls)) {
        throw new Error('fileUrls must be an array');
      }
      if (!payload.webhookUrl) {
        throw new Error('webhookUrl is required');
      }
      if (!payload.fileUrls.every(url => typeof url === 'string' && url.length > 0)) {
        throw new Error('All fileUrls must be non-empty strings');
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request payload', 
          details: e instanceof Error ? e.message : 'Failed to parse request body'
        }),
        {
          status: 400,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Send the data to n8n webhook
    const webhookResponse = await fetch(payload.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sectionId: payload.sectionId,
        fileUrls: payload.fileUrls,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!webhookResponse.ok) {
      throw new Error(`Webhook error: ${webhookResponse.status}`);
    }

    // Get the response from n8n
    const n8nData = await webhookResponse.json();

    // Store the webhook response in the database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: dbError } = await supabase
      .from('n8n_chat_histories')
      .insert({
        session_id: payload.sectionId,
        message: {
          type: 'webhook_response',
          content: n8nData,
          files: payload.fileUrls,
        },
      });

    if (dbError) {
      console.error('Database error:', dbError);
    }

    // Return the summary from n8n
    return new Response(
      JSON.stringify({ 
        summary: n8nData.summary || 'Document processing initiated' 
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing documents:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});