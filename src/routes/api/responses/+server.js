import { json } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function GET({ url }) {
    try {
        const type = url.searchParams.get('type');
        if (!type) {
            console.error('GET request missing type parameter');
            return json({ error: 'Type parameter is required' }, { status: 400 });
        }

        const filePath = path.join(__dirname, '..', '..', '..', 'data', `${type}_responses.json`);
        console.log(`GET request for type ${type}, looking for file at ${filePath}`);
        
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            console.log(`Successfully read data for type ${type}:`, data);
            return json(JSON.parse(data));
        } catch (error) {
            // If file doesn't exist, return empty array
            console.log(`File not found for type ${type}, returning empty array`);
            return json([]);
        }
    } catch (error) {
        console.error('Error in GET /api/responses:', error);
        return json({ error: error.message }, { status: 500 });
    }
}

export async function POST({ request, url }) {
    try {
        const type = url.searchParams.get('type');
        if (!type) {
            console.error('POST request missing type parameter');
            return json({ error: 'Type parameter is required' }, { status: 400 });
        }

        const filePath = path.join(__dirname, '..', '..', '..', 'data', `${type}_responses.json`);
        console.log(`POST request for type ${type}, writing to file at ${filePath}`);
        
        const data = await request.json();
        console.log(`Received data for type ${type}:`, data);
        
        // Ensure the data directory exists
        const dataDir = path.dirname(filePath);
        await fs.mkdir(dataDir, { recursive: true });
        
        // Write the data
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        console.log(`Successfully wrote data for type ${type}`);
        
        return json({ success: true });
    } catch (error) {
        console.error('Error in POST /api/responses:', error);
        return json({ error: error.message }, { status: 500 });
    }
} 