// Carregar variáveis de ambiente
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as dotenv from 'dotenv';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env com caminho absoluto
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Verificar se as variáveis foram carregadas
console.log('Verificando variáveis de ambiente:');
console.log('TELEGRAM_TOKEN definido:', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('DISCORD_TOKEN definido:', !!process.env.DISCORD_BOT_TOKEN);

// Importar módulos
import { Telegraf, Markup } from 'telegraf';
import { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
  EmbedBuilder
} from 'discord.js';
import axios from 'axios';
import fs from 'fs';
import express from 'express';
import { franc } from 'franc';

// Configurações
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_CATEGORY_ID = process.env.DISCORD_CATEGORY_ID;
const DISCORD_ARCHIVE_CATEGORY_ID = process.env.DISCORD_ARCHIVE_CATEGORY_ID;
const DISCORD_MOD_ROLE_ID = process.env.DISCORD_MOD_ROLE_ID;
const PORT = process.env.PORT || 3000;

// Verificar configurações
if (!TELEGRAM_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN não configurado no arquivo .env');
  process.exit(1);
}

if (!DISCORD_TOKEN) {
  console.error('DISCORD_BOT_TOKEN não configurado no arquivo .env');
  process.exit(1);
}

console.log('Iniciando bots...');

// Criar servidor Express para webhooks
const app = express();
app.use(express.json());

// Criar bot do Telegram
const telegramBot = new Telegraf(TELEGRAM_TOKEN);

// Criar cliente Discord
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
  ]
});

// Variável para armazenar o canal do Discord
let discordChannel = null;

// Adicione esta variável para armazenar o servidor Discord
let discordGuild = null;

// Modificar o sistema de armazenamento de tickets
let activeTickets = []; // Armazenar apenas tickets ativos em memória

// Armazenamento simples
let userSessions = {};
let ticketCounters = {}; // Para rastrear contadores de tickets por usuário

// Adicionar objeto para armazenar o idioma preferido de cada usuário
let userLanguages = {};

// Carregar idiomas dos usuários se o arquivo existir
if (fs.existsSync('user_languages.json')) {
  try {
    const data = fs.readFileSync('user_languages.json', 'utf8');
    userLanguages = JSON.parse(data);
    console.log('User languages loaded');
  } catch (error) {
    console.error('Error loading user languages:', error);
    userLanguages = {};
  }
}

// Função para salvar idiomas dos usuários
function saveUserLanguages() {
  try {
    fs.writeFileSync('user_languages.json', JSON.stringify(userLanguages, null, 2));
  } catch (error) {
    console.error('Error saving user languages:', error);
  }
}

// Função para detectar o idioma de um texto
function detectLanguage(text) {
  try {
    const langCode = franc(text, { minLength: 3 });
    if (langCode === 'und') return 'en'; // Default to English if undetermined
    return langCode === 'por' ? 'pt' : (langCode === 'spa' ? 'es' : 'en');
  } catch (error) {
    console.error('Error detecting language:', error);
    return 'en'; // Default to English on error
  }
}

// Função para obter o idioma preferido de um usuário
function getUserLanguage(userId) {
  return userLanguages[userId] || 'en'; // Default to English
}

// Função para definir o idioma preferido de um usuário
function setUserLanguage(userId, language) {
  userLanguages[userId] = language;
  saveUserLanguages();
}

// Objeto com traduções
const translations = {
  en: {
    welcome: "👋 Hello, %s!\n\nWelcome to the support bot. You can create a new ticket at any time using the /newticket command.",
    help: "📚 *Available commands:*\n\n• /start - Start the bot\n• /newticket - Create a new support ticket\n• /mytickets - View your active ticket\n• /help - Show this help message\n• /language - Change your preferred language",
    newTicketPrompt: "📝 Let's create a new support ticket.\n\nPlease enter the subject of your ticket:",
    noTickets: "You don't have any open tickets at the moment.",
    yourTickets: "🎫 *Your active ticket:*\n\n",
    ticketCreated: "✅ Your ticket has been created successfully!\n\n*Ticket #%s*\n*Subject:* %s\n\nA member of our support team will respond shortly. You will receive a notification here when there is a response.\n\nYou can simply reply to this chat to add more information to your ticket.",
    messageSent: "✅ Your message has been sent successfully!",
    ticketNotFound: "❌ Ticket not found or already closed.",
    ticketClosed: "✅ Ticket #%s \"%s\" has been closed successfully.",
    ticketClosedBySupport: "🔒 *Ticket #%s Closed*\n\nYour ticket \"%s\" has been closed by the support team.",
    subjectTooShort: "⚠️ The subject must be between 3 and 100 characters. Please try again:",
    descriptionTooShort: "⚠️ The description is too short. Please provide more details:",
    tooManyTickets: "⚠️ You already have an open ticket. Please wait for it to be resolved before opening a new one.",
    enterDescription: "👍 Great! Now, please describe your problem in detail:",
    replyToMessage: "✏️ *Reply to this message to add a response to the ticket.*",
    supportReply: "💬 *Support Response (Ticket #%s):*\n\n%s\n\n_You can reply directly to this chat to respond to the ticket._",
    useNewTicket: "To create a new ticket, use the /newticket command.\nTo view your active ticket, use the /mytickets command.\nTo view all available commands, use /help.",
    errorCreatingTicket: "❌ An error occurred while creating the ticket. Please try again later.",
    selectLanguage: "🌐 *Select your preferred language:*",
    languageChanged: "✅ Your language has been changed to English.",
    closeTicketButton: "Close Ticket",
    replyTicketButton: "Reply",
    confirmCloseTicket: "Are you sure you want to close this ticket? This action cannot be undone.",
    alreadyHasTicket: "You already have an active ticket. Please continue the conversation in that ticket or close it before creating a new one."
  },
  pt: {
    welcome: "👋 Olá, %s!\n\nBem-vindo ao bot de suporte. Você pode criar um novo ticket a qualquer momento usando o comando /novoticket.",
    help: "📚 *Comandos disponíveis:*\n\n• /start - Inicia o bot\n• /novoticket - Cria um novo ticket de suporte\n• /meustickets - Visualiza seu ticket ativo\n• /ajuda - Mostra esta mensagem de ajuda\n• /idioma - Altera seu idioma preferido",
    newTicketPrompt: "📝 Vamos criar um novo ticket de suporte.\n\nPor favor, digite o assunto do seu ticket:",
    noTickets: "Você não possui tickets abertos no momento.",
    yourTickets: "🎫 *Seu ticket ativo:*\n\n",
    ticketCreated: "✅ Seu ticket foi criado com sucesso!\n\n*Ticket #%s*\n*Assunto:* %s\n\nUm membro da nossa equipe de suporte irá responder em breve. Você receberá uma notificação aqui quando houver uma resposta.\n\nVocê pode simplesmente responder a este chat para adicionar mais informações ao seu ticket.",
    messageSent: "✅ Sua mensagem foi enviada com sucesso!",
    ticketNotFound: "❌ Ticket não encontrado ou já foi fechado.",
    ticketClosed: "✅ Ticket #%s \"%s\" foi fechado com sucesso.",
    ticketClosedBySupport: "🔒 *Ticket #%s Fechado*\n\nSeu ticket \"%s\" foi fechado pela equipe de suporte.",
    subjectTooShort: "⚠️ O assunto deve ter entre 3 e 100 caracteres. Por favor, tente novamente:",
    descriptionTooShort: "⚠️ A descrição é muito curta. Por favor, forneça mais detalhes:",
    tooManyTickets: "⚠️ Você já possui um ticket aberto. Por favor, aguarde a resolução dele antes de abrir um novo.",
    enterDescription: "👍 Ótimo! Agora, por favor, descreva seu problema em detalhes:",
    replyToMessage: "✏️ *Responda a esta mensagem para adicionar uma resposta ao ticket.*",
    supportReply: "💬 *Resposta do Suporte (Ticket #%s):*\n\n%s\n\n_Você pode responder diretamente a este chat para responder ao ticket._",
    useNewTicket: "Para criar um novo ticket, use o comando /novoticket.\nPara ver seu ticket ativo, use o comando /meustickets.\nPara ver todos os comandos disponíveis, use /ajuda.",
    errorCreatingTicket: "❌ Ocorreu um erro ao criar o ticket. Por favor, tente novamente mais tarde.",
    selectLanguage: "🌐 *Selecione seu idioma preferido:*",
    languageChanged: "✅ Seu idioma foi alterado para Português.",
    closeTicketButton: "Fechar Ticket",
    replyTicketButton: "Responder",
    confirmCloseTicket: "Tem certeza que deseja fechar este ticket? Esta ação não pode ser desfeita.",
    alreadyHasTicket: "Você já possui um ticket ativo. Por favor, continue a conversa nesse ticket ou feche-o antes de criar um novo."
  },
  es: {
    welcome: "👋 ¡Hola, %s!\n\nBienvenido al bot de soporte. Puedes crear un nuevo ticket en cualquier momento usando el comando /nuevoticket.",
    help: "📚 *Comandos disponibles:*\n\n• /start - Inicia el bot\n• /nuevoticket - Crea un nuevo ticket de soporte\n• /mistickets - Ver tu ticket activo\n• /ayuda - Muestra este mensaje de ayuda\n• /idioma - Cambia tu idioma preferido",
    newTicketPrompt: "📝 Vamos a crear un nuevo ticket de soporte.\n\nPor favor, ingresa el asunto de tu ticket:",
    noTickets: "No tienes tickets abiertos en este momento.",
    yourTickets: "🎫 *Tu ticket activo:*\n\n",
    ticketCreated: "✅ ¡Tu ticket ha sido creado con éxito!\n\n*Ticket #%s*\n*Asunto:* %s\n\nUn miembro de nuestro equipo de soporte responderá en breve. Recibirás una notificación aquí cuando haya una respuesta.\n\nPuedes simplemente responder a este chat para añadir más información a tu ticket.",
    messageSent: "✅ ¡Tu mensaje ha sido enviado con éxito!",
    ticketNotFound: "❌ Ticket no encontrado o ya cerrado.",
    ticketClosed: "✅ Ticket #%s \"%s\" ha sido cerrado con éxito.",
    ticketClosedBySupport: "🔒 *Ticket #%s Cerrado*\n\nTu ticket \"%s\" ha sido cerrado por el equipo de soporte.",
    subjectTooShort: "⚠️ El asunto debe tener entre 3 y 100 caracteres. Por favor, inténtalo de nuevo:",
    descriptionTooShort: "⚠️ La descripción es demasiado corta. Por favor, proporciona más detalles:",
    tooManyTickets: "⚠️ Ya tienes un ticket abierto. Por favor, espera a que sea resuelto antes de abrir uno nuevo.",
    enterDescription: "👍 ¡Genial! Ahora, por favor, describe tu problema en detalle:",
    replyToMessage: "✏️ *Responde a este mensaje para añadir una respuesta al ticket.*",
    supportReply: "💬 *Respuesta del Soporte (Ticket #%s):*\n\n%s\n\n_Puedes responder directamente a este chat para responder al ticket._",
    useNewTicket: "Para crear un nuevo ticket, usa el comando /nuevoticket.\nPara ver tu ticket activo, usa el comando /mistickets.\nPara ver todos los comandos disponibles, usa /ayuda.",
    errorCreatingTicket: "❌ Ocurrió un error al crear el ticket. Por favor, inténtalo de nuevo más tarde.",
    selectLanguage: "🌐 *Selecciona tu idioma preferido:*",
    languageChanged: "✅ Tu idioma ha sido cambiado a Español.",
    closeTicketButton: "Cerrar Ticket",
    replyTicketButton: "Responder",
    confirmCloseTicket: "¿Estás seguro de que quieres cerrar este ticket? Esta acción no se puede deshacer.",
    alreadyHasTicket: "Ya tienes un ticket activo. Por favor, continúa la conversación en ese ticket o ciérralo antes de crear uno nuevo."
  }
};

// Função para obter uma tradução
function getTranslation(key, language, ...args) {
  const translation = translations[language] && translations[language][key] 
    ? translations[language][key] 
    : translations.en[key];
  
  if (args.length > 0) {
    let result = translation;
    for (let i = 0; i < args.length; i++) {
      result = result.replace('%s', args[i] || '');
    }
    return result;
  }
  
  return translation;
}

// Função para salvar apenas tickets ativos
function saveActiveTickets() {
  try {
    fs.writeFileSync('active_tickets.json', JSON.stringify(activeTickets, null, 2));
    console.log(`Saved ${activeTickets.length} active tickets`);
  } catch (error) {
    console.error('Error saving active tickets:', error);
  }
}

// Função para carregar tickets ativos
function loadActiveTickets() {
  try {
    if (fs.existsSync('active_tickets.json')) {
      const data = fs.readFileSync('active_tickets.json', 'utf8');
      activeTickets = JSON.parse(data);
      console.log(`Loaded ${activeTickets.length} active tickets`);
      
      // Listar todos os tickets carregados para depuração
      console.log('Tickets carregados:');
      activeTickets.forEach(t => {
        console.log(`- ID: ${t.id}, Status: ${t.status}, DiscordChannelId: ${t.discordChannelId || 'Nenhum'}`);
      });
    } else {
      console.log('Arquivo active_tickets.json não encontrado, iniciando com lista vazia');
      activeTickets = [];
    }
  } catch (error) {
    console.error('Error loading active tickets:', error);
    activeTickets = [];
  }
}

// Carregar tickets ativos na inicialização
loadActiveTickets();

// Função para gerar ID de ticket
function generateTicketId(userId) {
  console.log(`[DEBUG-ID] Gerando ID de ticket para usuário: ${userId}`);
  
  // Garantir que userId seja uma string
  const userIdStr = userId.toString();
  console.log(`[DEBUG-ID] UserID como string: ${userIdStr}`);
  
  // Inicializar contador se não existir
  if (!ticketCounters[userIdStr]) {
    console.log(`[DEBUG-ID] Inicializando contador para usuário ${userIdStr}`);
    ticketCounters[userIdStr] = 0;
  }
  
  // Incrementar contador
  ticketCounters[userIdStr]++;
  console.log(`[DEBUG-ID] Novo valor do contador: ${ticketCounters[userIdStr]}`);
  
  // Gerar ID no formato userId_contador
  const ticketId = `${userIdStr}_${ticketCounters[userIdStr]}`;
  console.log(`[DEBUG-ID] ID de ticket gerado: ${ticketId}`);
  console.log(`[DEBUG-ID] Comprimento do ID: ${ticketId.length}`);
  console.log(`[DEBUG-ID] Caracteres do ID: ${Array.from(ticketId).join(', ')}`);
  
  return ticketId;
}

// Função para criar um novo ticket
function createTicket(userId, username, firstName, subject, description) {
  console.log(`Criando ticket para usuário: ${userId}`);
  
  // Verificar se o usuário já tem um ticket ativo
  const existingTicket = activeTickets.find(t => t.userId === userId.toString() && t.status === 'open');
  if (existingTicket) {
    console.log(`Usuário ${userId} já tem um ticket ativo: ${existingTicket.id}`);
    return { error: 'already_has_ticket', ticket: existingTicket };
  }
  
  const ticketId = generateTicketId(userId);
  console.log(`ID do ticket gerado: ${ticketId}`);
  
  const newTicket = {
    id: ticketId,
    userId: userId.toString(),
    username: username || firstName || 'Unknown',
    firstName: firstName || 'User',
    subject,
    status: 'open',
    createdAt: new Date().toISOString(),
    messages: [
      {
        sender: 'user',
        content: description,
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  console.log(`Novo ticket criado: ${JSON.stringify(newTicket, null, 2)}`);
  activeTickets.push(newTicket);
  saveActiveTickets();
  
  return { ticket: newTicket };
}

// Função para obter um ticket pelo ID
function getTicketById(ticketId) {
  console.log(`[DEBUG] Buscando ticket com ID: ${ticketId}`);
  console.log(`[DEBUG] Tickets ativos: ${activeTickets.length}`);
  
  // Listar todos os IDs de tickets ativos para depuração
  console.log('[DEBUG] IDs de tickets ativos:');
  activeTickets.forEach(t => console.log(`[DEBUG] - ${t.id} (status: ${t.status})`));
  
  // Verificar se o ID do ticket contém caracteres especiais
  console.log(`[DEBUG] Verificando caracteres no ID do ticket: ${ticketId}`);
  console.log(`[DEBUG] Comprimento do ID: ${ticketId.length}`);
  console.log(`[DEBUG] Caracteres do ID: ${Array.from(ticketId).join(', ')}`);
  
  // Tentar encontrar o ticket com correspondência exata
  let ticket = activeTickets.find(t => t.id === ticketId);
  console.log(`[DEBUG] Ticket encontrado com correspondência exata: ${ticket ? 'Sim' : 'Não'}`);
  
  // Se não encontrar com correspondência exata, tentar encontrar com startsWith
  if (!ticket) {
    console.log(`[DEBUG] Tentando encontrar ticket que comece com: ${ticketId}`);
    ticket = activeTickets.find(t => t.id.startsWith(ticketId));
    if (ticket) {
      console.log(`[DEBUG] Ticket encontrado com startsWith: ${ticket.id}`);
    }
  }
  
  // Se ainda não encontrar, tentar extrair o ID do usuário e o contador
  if (!ticket && ticketId.includes('_')) {
    console.log(`[DEBUG] Tentando extrair partes do ID: ${ticketId}`);
    const parts = ticketId.split('_');
    if (parts.length >= 2) {
      const userId = parts[0];
      console.log(`[DEBUG] UserID extraído: ${userId}`);
      
      // Procurar tickets deste usuário
      const userTickets = activeTickets.filter(t => t.userId === userId && t.status === 'open');
      console.log(`[DEBUG] Tickets encontrados para o usuário ${userId}: ${userTickets.length}`);
      
      if (userTickets.length > 0) {
        // Retornar o primeiro ticket ativo do usuário
        ticket = userTickets[0];
        console.log(`[DEBUG] Usando o primeiro ticket ativo do usuário: ${ticket.id}`);
      }
    }
  }
  
  return ticket;
}

// Função para fechar um ticket
function closeTicket(ticketId) {
  console.log(`[DEBUG] Tentando fechar o ticket: ${ticketId}`);
  
  // Primeiro, tentar encontrar o ticket usando a função getTicketById
  const ticket = getTicketById(ticketId);
  
  if (ticket) {
    console.log(`[DEBUG] Ticket encontrado para fechamento: ${JSON.stringify(ticket)}`);
    
    // Encontrar o índice do ticket na lista de ativos
    const index = activeTickets.findIndex(t => t.id === ticket.id);
    console.log(`[DEBUG] Índice do ticket na lista de ativos: ${index}`);
    
    if (index !== -1) {
      // Remover o ticket da lista de ativos
      activeTickets.splice(index, 1);
      saveActiveTickets();
      console.log(`[DEBUG] Ticket removido da lista de ativos e lista salva`);
      return ticket;
    } else {
      console.log(`[DEBUG] Ticket encontrado mas não está na lista de ativos (índice: ${index})`);
    }
  } else {
    console.log(`[DEBUG] Ticket não encontrado para fechamento: ${ticketId}`);
    
    // Tentar encontrar diretamente na lista de ativos
    const index = activeTickets.findIndex(t => t.id === ticketId);
    console.log(`[DEBUG] Tentativa direta - Índice do ticket: ${index}`);
    
    if (index !== -1) {
      const ticket = activeTickets[index];
      console.log(`[DEBUG] Ticket encontrado diretamente: ${JSON.stringify(ticket)}`);
      activeTickets.splice(index, 1);
      saveActiveTickets();
      console.log(`[DEBUG] Ticket removido da lista de ativos e lista salva`);
      return ticket;
    }
  }
  
  console.log(`[DEBUG] Não foi possível fechar o ticket: ${ticketId}`);
  return null;
}

// Função para sincronizar com o Discord na inicialização
async function syncWithDiscord() {
  if (!discordGuild) return;
  
  console.log('Syncing with Discord channels...');
  
  try {
    // Verificar canais de ticket existentes
    const channels = await discordGuild.channels.fetch();
    const ticketChannels = channels.filter(channel => 
      channel.type === 0 && // GUILD_TEXT
      channel.name.startsWith('ticket-') && 
      !channel.name.startsWith('closed-')
    );
    
    console.log(`Found ${ticketChannels.size} active ticket channels in Discord`);
    
    // Para cada canal de ticket, verificar se já temos o ticket em memória
    for (const [id, channel] of ticketChannels) {
      try {
        console.log(`Processando canal: ${channel.name} (${channel.id})`);
        
        const topic = channel.topic;
        if (!topic) {
          console.log(`Canal ${channel.name} sem tópico, ignorando`);
          continue;
        }
        
        console.log(`Tópico do canal: ${topic}`);
        
        const ticketIdMatch = topic.match(/Ticket #([a-zA-Z0-9_]+)/);
        const userIdMatch = topic.match(/Telegram ID: (\d+)/);
        
        if (!ticketIdMatch || !userIdMatch) {
          console.log(`Canal ${channel.name} sem ID de ticket ou ID de usuário no tópico, ignorando`);
          continue;
        }
        
        const ticketId = ticketIdMatch[1];
        const userId = userIdMatch[1];
        
        console.log(`ID do ticket extraído: ${ticketId}, ID do usuário: ${userId}`);
        
        // Verificar se já temos este ticket
        const existingTicket = getTicketById(ticketId);
        if (existingTicket) {
          console.log(`Ticket ${ticketId} já existe, atualizando ID do canal se necessário`);
          
          // Verificar se o ticket foi criado recentemente (nos últimos 30 segundos)
          const isRecentlyCreated = existingTicket.createdAt && 
                                   (new Date().getTime() - new Date(existingTicket.createdAt).getTime() < 30000);
          
          // Atualizar o ID do canal apenas se não for um ticket recém-criado ou se não tiver ID de canal
          if (!isRecentlyCreated && existingTicket.discordChannelId !== id) {
            console.log(`Atualizando ID do canal de ${existingTicket.discordChannelId || 'Nenhum'} para ${id}`);
            existingTicket.discordChannelId = id;
            saveActiveTickets();
          } else if (isRecentlyCreated) {
            console.log(`Ticket ${ticketId} foi criado recentemente, mantendo o ID do canal original: ${existingTicket.discordChannelId}`);
          }
          continue;
        }
        
        // Extrair o assunto do nome do canal
        const subjectMatch = channel.name.match(/ticket-[a-zA-Z0-9]+-(.+)/);
        const subject = subjectMatch ? subjectMatch[1].replace(/-/g, ' ') : 'Unknown Subject';
        
        // Criar um novo ticket baseado no canal
        const newTicket = {
          id: ticketId,
          userId: userId,
          username: 'User from Discord',
          firstName: 'User',
          subject: subject,
          status: 'open',
          createdAt: channel.createdAt.toISOString(),
          discordChannelId: id,
          messages: [
            {
              sender: 'system',
              content: 'This ticket was synchronized from Discord.',
              timestamp: new Date().toISOString()
            }
          ]
        };
        
        activeTickets.push(newTicket);
      } catch (error) {
        console.error(`Error processing channel ${id}:`, error);
      }
    }
    
    saveActiveTickets();
    console.log('Discord synchronization complete');
  } catch (error) {
    console.error('Error syncing with Discord:', error);
  }
}

// Função para adicionar mensagem a um ticket
function addMessage(ticketId, sender, content) {
  const ticket = activeTickets.find(t => t.id === ticketId);
  if (!ticket) return null;
  
  ticket.messages.push({
    sender,
    content,
    timestamp: new Date().toISOString()
  });
  
  saveActiveTickets();
  return ticket;
}

// Função para enviar mensagem para o Discord
async function sendToDiscord(ticket, message, isNewTicket = false) {
  try {
    console.log(`Sending to Discord (Ticket #${ticket.id}): ${message.substring(0, 30)}...`);
    console.log(`Detalhes do ticket: ID=${ticket.id}, Status=${ticket.status}, DiscordChannelId=${ticket.discordChannelId || 'Nenhum'}`);
    
    // Verificar se o ticket está fechado
    if (ticket.status === 'closed') {
      console.log(`Ticket #${ticket.id} is closed, not sending to Discord`);
      return false;
    }
    
    let channel;
    
    // Se o ticket já tem um canal associado, usar esse canal
    if (ticket.discordChannelId) {
      try {
        console.log(`Buscando canal do Discord com ID: ${ticket.discordChannelId}`);
        channel = await discordClient.channels.fetch(ticket.discordChannelId);
        console.log(`Canal encontrado: ${channel.name}`);
      } catch (error) {
        console.error(`Error fetching channel ${ticket.discordChannelId}:`, error);
        channel = null;
      }
    }
    
    // Se não tem canal ou não foi possível recuperar, criar um novo
    if (!channel && isNewTicket) {
      channel = await createTicketChannel(ticket);
    }
    
    // Se ainda não tem canal, enviar para o canal padrão
    if (!channel && DISCORD_CHANNEL_ID) {
      try {
        channel = await discordClient.channels.fetch(DISCORD_CHANNEL_ID);
      } catch (error) {
        console.error(`Error fetching default channel ${DISCORD_CHANNEL_ID}:`, error);
        return false;
      }
    }
    
    // Se não foi possível obter um canal, falhar
    if (!channel) {
      console.error('No Discord channel available for sending message');
      return false;
    }
    
    // Se for uma nova mensagem em um ticket existente
    if (!isNewTicket) {
      const embed = new EmbedBuilder()
        .setTitle(`Reply to Ticket #${ticket.id}`)
        .setDescription(message)
        .setColor(0x00AE86)
        .setFooter({ text: `From: ${ticket.username} (${ticket.userId})` })
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
    }
    
    return true;
  } catch (error) {
    console.error('Error sending to Discord:', error);
    return false;
  }
}

// Função para enviar mensagem para o Telegram usando API direta
async function sendToTelegramAPI(userId, message, ticketId, options = {}) {
  try {
    console.log(`Sending to Telegram API (${userId}): ${message.substring(0, 30)}...`);
    
    // Verificar se o userId é válido
    if (!userId) {
      console.error('Invalid Telegram user ID');
      return false;
    }
    
    // Obter o idioma do usuário
    const lang = getUserLanguage(userId);
    
    // Preparar a mensagem
    let text = getTranslation('supportReply', lang, escapeMarkdown(ticketId), escapeMarkdown(message));
    
    // Configurar o teclado com botões, se necessário
    let keyboard = undefined;
    
    // Adicionar botões apenas se não for uma mensagem de fechamento de ticket
    if (!options.isClosingMessage) {
      // Adicionar botão para fechar o ticket
      const closeButtonText = getTranslation('closeTicketButton', lang);
      
      keyboard = {
        inline_keyboard: [
          [
            { text: closeButtonText, callback_data: `direct_close_${ticketId}` }
          ]
        ]
      };
    }
    
    // Tentar enviar com MarkdownV2
    try {
      const response = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
        chat_id: userId,
        text: text,
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
      });
      
      if (response.data && response.data.ok) {
        console.log(`Message sent successfully to Telegram API (${userId})`);
        return true;
      }
    } catch (markdownError) {
      console.error('Error sending with MarkdownV2:', markdownError.response ? markdownError.response.data : markdownError.message);
      
      // Tentar enviar sem formatação
      try {
        const plainText = `Support:\n\n${message}\n\n`;
        
        const response = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
          chat_id: userId,
          text: plainText,
          reply_markup: keyboard
        });
        
        if (response.data && response.data.ok) {
          console.log(`Plain message sent successfully to Telegram API (${userId})`);
          return true;
        } else {
          console.error('Error in Telegram API response:', response.data);
          return false;
        }
      } catch (plainError) {
        console.error('Error sending plain message:', plainError.response ? plainError.response.data : plainError.message);
        return false;
      }
    }
  } catch (error) {
    console.error('Error sending to Telegram API:', error.response ? error.response.data : error.message);
    return false;
  }
}

// Função para escapar caracteres especiais do Markdown
function escapeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/\!/g, '\\!');
}

// Configurar comandos do Telegram
telegramBot.command(['start'], async (ctx) => {
  console.log('Command /start received');
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name || 'user';
  
  // Detectar idioma com base no nome do usuário
  const detectedLang = detectLanguage(firstName);
  if (!userLanguages[userId]) {
    setUserLanguage(userId, detectedLang);
  }
  
  const lang = getUserLanguage(userId);
  
  await ctx.reply(
    getTranslation('welcome', lang, firstName),
    Markup.keyboard([
      ['/newticket', '/mytickets'],
      ['/help', '/language']
    ]).resize()
  );
});

telegramBot.command(['help', 'ajuda', 'ayuda'], async (ctx) => {
  console.log('Help command received');
  const userId = ctx.from.id;
  const lang = getUserLanguage(userId);
  
  try {
    const helpText = getTranslation('help', lang);
    await ctx.reply(helpText, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    console.error('Error sending help message with MarkdownV2:', error);
    // Tentar sem formatação
    await ctx.reply(getTranslation('help', lang).replace(/\*/g, ''));
  }
});

telegramBot.command(['newticket', 'novoticket', 'nuevoticket'], async (ctx) => {
  console.log('New ticket command received');
  const userId = ctx.from.id;
  const lang = getUserLanguage(userId);
  
  // Verificar se o usuário já tem um ticket ativo
  const existingTicket = activeTickets.find(t => t.userId === userId.toString() && t.status === 'open');
  if (existingTicket) {
    // Informar ao usuário que ele já tem um ticket ativo
    const ticketInfo = `*Ticket #${escapeMarkdown(existingTicket.id)}: ${escapeMarkdown(existingTicket.subject)}*`;
    const message = getTranslation('alreadyHasTicket', lang);
    
    try {
      await ctx.reply(`${message}\n\n${ticketInfo}`, { 
        parse_mode: 'MarkdownV2',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(getTranslation('closeTicketButton', lang), `direct_close_${existingTicket.id}`)]
        ])
      });
    } catch (error) {
      console.error('Error sending ticket info:', error);
      await ctx.reply(message.replace(/\*/g, '') + ` (#${existingTicket.id})`);
    }
    
    // Definir o ticket ativo para o usuário
    userSessions[userId] = { state: 'replying', ticketId: existingTicket.id };
    
    return;
  }
  
  // Iniciar processo de criação de ticket
  userSessions[userId] = { state: 'awaiting_subject' };
  
  await ctx.reply(getTranslation('newTicketPrompt', lang));
});

telegramBot.command(['mytickets', 'meustickets', 'mistickets'], async (ctx) => {
  console.log('My tickets command received');
  const userId = ctx.from.id;
  const lang = getUserLanguage(userId);
  
  // Encontrar o ticket ativo do usuário
  const userTicket = activeTickets.find(t => t.userId === userId.toString() && t.status === 'open');
  
  if (!userTicket) {
    return ctx.reply(getTranslation('noTickets', lang));
  }
  
  let message = getTranslation('yourTickets', lang);
  
  message += `*Ticket #${userTicket.id}: ${userTicket.subject}*\n`;
  message += `${new Date(userTicket.createdAt).toLocaleString()}\n\n`;
  message += getTranslation('replyToMessage', lang);
  
  // Criar botão para fechar o ticket
  const buttons = [
    [Markup.button.callback(getTranslation('closeTicketButton', lang), `direct_close_${userTicket.id}`)]
  ];
  
  try {
    // Escapar caracteres especiais do Markdown
    let escapedMessage = message
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/~/g, '\\~')
      .replace(/`/g, '\\`')
      .replace(/>/g, '\\>')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/\!/g, '\\!');
    
    // Definir o estado da sessão para responder ao ticket
    userSessions[userId] = { state: 'replying', ticketId: userTicket.id };
    
    await ctx.reply(escapedMessage, { 
      parse_mode: 'MarkdownV2',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error('Error sending ticket info with MarkdownV2:', error);
    // Tentar sem formatação
    let plainMessage = message.replace(/\*/g, '');
    await ctx.reply(plainMessage, { 
      ...Markup.inlineKeyboard(buttons)
    });
  }
});

// Comando para mudar idioma
telegramBot.command(['language', 'idioma'], async (ctx) => {
  console.log('Language command received');
  const userId = ctx.from.id;
  
  await ctx.reply(
    getTranslation('selectLanguage', getUserLanguage(userId)),
    Markup.inlineKeyboard([
      [Markup.button.callback('English 🇬🇧', 'lang_en')],
      [Markup.button.callback('Português 🇧🇷', 'lang_pt')],
      [Markup.button.callback('Español 🇪🇸', 'lang_es')]
    ])
  );
});

// Manipulador para seleção de idioma
telegramBot.action(/lang_(.+)/, async (ctx) => {
  const lang = ctx.match[1];
  const userId = ctx.from.id;
  
  setUserLanguage(userId, lang);
  
  await ctx.answerCbQuery();
  await ctx.editMessageText(getTranslation('languageChanged', lang));
});

// Manipulador de mensagens de texto
telegramBot.on('text', async (ctx) => {
  console.log('Text message received:', ctx.message.text.substring(0, 30) + '...');
  
  // Ignorar comandos
  if (ctx.message.text.startsWith('/')) {
    return;
  }
  
  const userId = ctx.from.id;
  const lang = getUserLanguage(userId);
  const session = userSessions[userId];
  
  // Verificar se o usuário tem um ticket ativo
  const activeTicket = activeTickets.find(t => t.userId === userId.toString() && t.status === 'open');
  
  // Se não há sessão ativa, mas há um ticket ativo, configurar a sessão para responder a esse ticket
  if (!session && activeTicket) {
    userSessions[userId] = { state: 'replying', ticketId: activeTicket.id };
    console.log(`Configurando sessão para responder ao ticket ativo ${activeTicket.id}`);
  }
  
  // Obter a sessão atualizada
  const updatedSession = userSessions[userId];
  
  // Se ainda não há sessão ativa, mostrar ajuda
  if (!updatedSession) {
    return ctx.reply(getTranslation('useNewTicket', lang));
  }
  
  // Processamento baseado no estado da sessão
  switch (updatedSession.state) {
    case 'awaiting_subject':
      // Usuário está informando o assunto do ticket
      const subject = ctx.message.text.trim();
      
      if (subject.length < 3 || subject.length > 100) {
        return ctx.reply(getTranslation('subjectTooShort', lang));
      }
      
      // Atualizar estado da sessão
      userSessions[userId] = { state: 'awaiting_description', subject };
      
      await ctx.reply(getTranslation('enterDescription', lang));
      break;
      
    case 'awaiting_description':
      // Usuário está informando a descrição do ticket
      const description = ctx.message.text.trim();
      
      if (description.length < 10) {
        return ctx.reply(getTranslation('descriptionTooShort', lang));
      }
      
      try {
        // Criar o ticket
        const result = createTicket(
          userId,
          ctx.from.username,
          ctx.from.first_name,
          updatedSession.subject,
          description
        );
        
        // Verificar se houve erro na criação do ticket
        if (result.error === 'already_has_ticket') {
          // Informar ao usuário que ele já tem um ticket ativo
          const existingTicket = result.ticket;
          const ticketInfo = `*Ticket #${escapeMarkdown(existingTicket.id)}: ${escapeMarkdown(existingTicket.subject)}*`;
          const message = `You already have an active ticket:\n\n${ticketInfo}\n\nPlease continue the conversation in this ticket or close it before creating a new one.`;
          
          try {
            await ctx.reply(message, { 
              parse_mode: 'MarkdownV2',
              ...Markup.inlineKeyboard([
                [Markup.button.callback(getTranslation('closeTicketButton', lang), `direct_close_${existingTicket.id}`)]
              ])
            });
          } catch (error) {
            console.error('Error sending ticket info:', error);
            await ctx.reply(`You already have an active ticket (#${existingTicket.id}). Please close it before creating a new one.`);
          }
          
          // Definir o ticket ativo para o usuário
          userSessions[userId] = { state: 'replying', ticketId: existingTicket.id };
          
          return;
        }
        
        const ticket = result.ticket;
        
        // Configurar sessão para responder ao novo ticket
        userSessions[userId] = { state: 'replying', ticketId: ticket.id };
        
        // Confirmar criação
        try {
          const ticketCreatedMessage = getTranslation(
            'ticketCreated', 
            lang, 
            escapeMarkdown(ticket.id), 
            escapeMarkdown(ticket.subject)
          );
          
          // Adicionar botão para fechar o ticket
          const closeButtonText = getTranslation('closeTicketButton', lang);
          
          await ctx.reply(ticketCreatedMessage, { 
            parse_mode: 'MarkdownV2',
            ...Markup.inlineKeyboard([
              [Markup.button.callback(closeButtonText, `direct_close_${ticket.id}`)]
            ])
          });
        } catch (markdownError) {
          console.error('Error sending ticket created message with MarkdownV2:', markdownError);
          // Tentar sem formatação
          await ctx.reply(`Ticket #${ticket.id} "${ticket.subject}" has been created!\n\nYou can reply directly to this chat to respond to the ticket.`, {
            ...Markup.inlineKeyboard([
              [Markup.button.callback(getTranslation('closeTicketButton', lang), `direct_close_${ticket.id}`)]
            ])
          });
        }
        
        // Enviar para o Discord
        await sendToDiscord(ticket, description, true);
      } catch (error) {
        console.error('Error creating ticket:', error);
        await ctx.reply(getTranslation('errorCreatingTicket', lang));
      }
      break;
      
    case 'replying':
      // Usuário está respondendo a um ticket ativo
      const message = ctx.message.text.trim();
      const ticketId = updatedSession.ticketId;
      
      const ticket = activeTickets.find(t => t.id === ticketId);
      if (!ticket) {
        delete userSessions[userId];
        return ctx.reply(getTranslation('ticketNotFound', lang));
      }
      
      // Adicionar mensagem ao ticket
      ticket.messages.push({
        sender: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });
      saveActiveTickets();
      
      // Confirmar envio
      await ctx.reply(getTranslation('messageSent', lang));
      
      // Enviar para o Discord
      await sendToDiscord(ticket, message, false);
      break;
      
    default:
      // Estado desconhecido, limpar sessão
      delete userSessions[userId];
      await ctx.reply(getTranslation('useNewTicket', lang));
  }
});

// Configurar bot do Discord
discordClient.on('ready', async () => {
  console.log(`Bot do Discord conectado como ${discordClient.user.tag}`);
  
  // Obter o servidor Discord
  if (DISCORD_GUILD_ID) {
    try {
      discordGuild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
      console.log(`Servidor Discord configurado: ${discordGuild.name}`);
      
      // Sincronizar com o Discord
      await syncWithDiscord();
    } catch (error) {
      console.error('Erro ao obter servidor Discord:', error);
    }
  } else {
    console.warn('DISCORD_GUILD_ID não configurado. Não será possível criar canais automaticamente.');
  }
  
  // Obter o canal para enviar mensagens (fallback)
  if (DISCORD_CHANNEL_ID) {
    try {
      discordChannel = await discordClient.channels.fetch(DISCORD_CHANNEL_ID);
      console.log(`Canal do Discord configurado: ${discordChannel.name}`);
    } catch (error) {
      console.error('Erro ao obter canal do Discord:', error);
    }
  }
});

// Função para criar um canal para o ticket
async function createTicketChannel(ticket) {
  if (!discordGuild) {
    console.error('Servidor Discord não configurado');
    return null;
  }
  
  try {
    console.log(`Criando canal para o ticket #${ticket.id}`);
    
    // Buscar o cargo @everyone
    const everyoneRole = discordGuild.roles.everyone;
    
    // Buscar o bot
    const botUser = discordClient.user;
    
    // Verificar se o bot e o cargo @everyone existem
    if (!everyoneRole) {
      console.error('Cargo @everyone não encontrado');
      return null;
    }
    
    if (!botUser) {
      console.error('Bot não encontrado');
      return null;
    }
    
    // Definir permissões do canal
    const permissionOverwrites = [
      {
        id: everyoneRole.id,
        deny: ['ViewChannel', 'SendMessages']
      },
      {
        id: botUser.id,
        allow: ['ViewChannel', 'SendMessages', 'ManageChannels', 'ManageMessages']
      }
    ];
    
    // Adicionar permissão para o cargo de moderador, se configurado
    if (DISCORD_MOD_ROLE_ID) {
      try {
        // Verificar se o cargo existe antes de adicionar
        const modRole = await discordGuild.roles.fetch(DISCORD_MOD_ROLE_ID);
        if (modRole) {
          permissionOverwrites.push({
            id: modRole.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
          });
        } else {
          console.warn(`Cargo de moderador ${DISCORD_MOD_ROLE_ID} não encontrado`);
        }
      } catch (error) {
        console.error(`Erro ao buscar cargo de moderador ${DISCORD_MOD_ROLE_ID}:`, error);
      }
    }
    
    // Criar o canal
    const channelName = `ticket-${ticket.id}-${ticket.username.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
    
    // Verificar se a categoria existe
    let parent = null;
    if (DISCORD_CATEGORY_ID) {
      try {
        console.log(`[DEBUG] Buscando categoria para tickets ativos: ${DISCORD_CATEGORY_ID}`);
        parent = await discordGuild.channels.fetch(DISCORD_CATEGORY_ID);
        console.log(`[DEBUG] Categoria encontrada: ${parent ? parent.name : 'Não encontrada'}`);
        
        // Verificar se não está usando a categoria de arquivamento por engano
        if (parent && DISCORD_ARCHIVE_CATEGORY_ID && parent.id === DISCORD_ARCHIVE_CATEGORY_ID) {
          console.error(`[DEBUG] ERRO: A categoria configurada é a de arquivamento! Categoria ativa: ${parent.id}, Categoria de arquivamento: ${DISCORD_ARCHIVE_CATEGORY_ID}`);
          console.error(`[DEBUG] Definindo parent como null para evitar criar tickets na categoria errada`);
          parent = null;
        }
      } catch (error) {
        console.error(`Erro ao buscar categoria ${DISCORD_CATEGORY_ID}:`, error);
        parent = null;
      }
    }
    
    // Se não encontrou a categoria, tentar buscar todas as categorias e encontrar a correta
    if (!parent && DISCORD_CATEGORY_ID) {
      try {
        console.log(`[DEBUG] Tentando buscar todas as categorias do servidor`);
        const categories = await discordGuild.channels.fetch();
        console.log(`[DEBUG] Categorias encontradas: ${categories.size}`);
        
        // Filtrar apenas canais do tipo categoria (type 4)
        const categoryChannels = categories.filter(channel => channel.type === 4);
        console.log(`[DEBUG] Categorias filtradas: ${categoryChannels.size}`);
        
        // Listar todas as categorias para depuração
        categoryChannels.forEach(category => {
          console.log(`[DEBUG] Categoria: ${category.name} (${category.id})`);
        });
        
        // Tentar encontrar a categoria pelo ID
        parent = categoryChannels.find(category => category.id === DISCORD_CATEGORY_ID);
        console.log(`[DEBUG] Categoria encontrada pelo ID: ${parent ? parent.name : 'Não encontrada'}`);
        
        // Verificar se não é a categoria de arquivamento
        if (parent && DISCORD_ARCHIVE_CATEGORY_ID && parent.id === DISCORD_ARCHIVE_CATEGORY_ID) {
          console.error(`[DEBUG] ERRO: A categoria encontrada é a de arquivamento! Definindo parent como null`);
          parent = null;
        }
      } catch (error) {
        console.error(`Erro ao buscar categorias do servidor:`, error);
        parent = null;
      }
    }
    
    console.log(`[DEBUG] Criando canal com parent: ${parent ? parent.id : 'null'}`);
    const channel = await discordGuild.channels.create({
      name: channelName,
      type: 0, // GUILD_TEXT
      parent: parent ? parent.id : null,
      permissionOverwrites: permissionOverwrites,
      topic: `Ticket #${ticket.id} | User: ${ticket.username} | Telegram ID: ${ticket.userId}`
    });
    
    console.log(`Canal criado: ${channel.name} (${channel.id})`);
    console.log(`Tópico do canal: ${channel.topic}`);

    // Atualizar o ticket com o ID do canal
    ticket.discordChannelId = channel.id;
    console.log(`Ticket atualizado com ID do canal: ${ticket.discordChannelId}`);
    saveActiveTickets();
    
    // Enviar mensagem inicial no canal
    const embed = new EmbedBuilder()
      .setTitle(`Ticket #${ticket.id}: ${ticket.subject}`)
      .setDescription(ticket.messages[0].content)
      .setColor(0x3498DB)
      .addFields(
        { name: 'Telegram ID', value: ticket.userId, inline: true },
        { name: 'User', value: ticket.username, inline: true },
        { name: 'Created at', value: new Date(ticket.createdAt).toLocaleString(), inline: true }
      )
      .setFooter({ text: `Ticket ID: ${ticket.id}` })
      .setTimestamp();
    
    // Criar apenas o botão de fechar
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`close_${ticket.id}`)
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );
    
    // Enviar mensagem de instruções
    await channel.send({ 
      content: `**New Ticket #${ticket.id}**\n\n` +
               `📝 **Instructions:**\n` +
               `• All messages sent in this channel will be forwarded to the user on Telegram\n` +
               `• Use the "Close Ticket" button when the issue is resolved\n` +
               `• You can send messages normally in this channel`, 
      embeds: [embed], 
      components: [row] 
    });
    
    // Não mover para a categoria de arquivamento aqui
    // Isso será feito apenas quando o ticket for fechado
    
    return channel;
  } catch (error) {
    console.error('Error creating channel for ticket:', error);
    return null;
  }
}

// Função para processar respostas do Discord
async function handleDiscordReply(ticketId, content, authorName) {
  console.log(`Resposta do Discord para o ticket ${ticketId}: "${content.substring(0, 30)}..."`);
  
  // Encontrar o ticket
  const ticket = getTicketById(ticketId);
  if (!ticket) {
    console.error(`Ticket ${ticketId} não encontrado`);
    
    // Tentar encontrar o ticket por ID parcial
    if (ticketId.includes('_')) {
      const [prefix, number] = ticketId.split('_');
      console.log(`Tentando encontrar ticket com prefixo ${prefix} e número ${number}`);
    } else {
      console.log(`Tentando encontrar ticket que comece com ${ticketId}_`);
      const matchingTicket = activeTickets.find(t => t.id.startsWith(ticketId + '_'));
      if (matchingTicket) {
        console.log(`Ticket encontrado com ID completo: ${matchingTicket.id}`);
        return handleDiscordReply(matchingTicket.id, content, authorName);
      }
    }
    
    return false;
  }
  
  // Verificar se o ticket está fechado
  if (ticket.status === 'closed') {
    console.error(`Ticket ${ticketId} está fechado`);
    return false;
  }
  
  try {
    // Adicionar mensagem ao ticket
    addMessage(ticketId, 'support', content);
    console.log(`Mensagem adicionada ao ticket ${ticketId}`);
    
    // Enviar mensagem para o usuário no Telegram usando API direta
    const result = await sendToTelegramAPI(ticket.userId, content, ticketId, { isClosingMessage: true });
    console.log(`Resultado do envio para o Telegram: ${result ? 'Sucesso' : 'Falha'}`);
    
    return result;
  } catch (error) {
    console.error(`Erro ao processar resposta do Discord para o ticket ${ticketId}:`, error);
    return false;
  }
}

// Rota para testar o envio para o Telegram
app.get('/test-telegram/:userId/:message', async (req, res) => {
  const { userId, message } = req.params;
  
  try {
    const result = await sendToTelegramAPI(userId, message, 'TEST');
    
    if (result) {
      res.send(`Mensagem enviada com sucesso para ${userId}`);
    } else {
      res.status(500).send(`Falha ao enviar mensagem para ${userId}`);
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem de teste:', error);
    res.status(500).send(`Erro: ${error.message}`);
  }
});

// Iniciar o servidor Express
const server = app.listen(PORT, () => {
  console.log(`Servidor Express rodando na porta ${PORT}`);
});

// Iniciar o bot do Telegram
telegramBot.launch()
  .then(() => {
    console.log('Bot do Telegram iniciado com sucesso!');
  })
  .catch(err => {
    console.error('Erro ao iniciar o bot do Telegram:', err);
    process.exit(1);
  });

// Fazer login no Discord
discordClient.login(DISCORD_TOKEN)
  .catch(err => {
    console.error('Erro ao conectar ao Discord:', err);
  });

// Habilitar graceful stop
process.once('SIGINT', async () => {
  console.log('Encerrando aplicação...');
  
  discordClient.destroy();
  console.log('Bot do Discord desconectado');
  
  telegramBot.stop('SIGINT');
  console.log('Bot do Telegram encerrado');
  
  server.close(() => {
    console.log('Servidor HTTP encerrado');
    process.exit(0);
  });
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Modificar o manipulador de mensagens do Discord para usar inglês
discordClient.on('messageCreate', async (message) => {
  // Ignorar mensagens do próprio bot
  if (message.author.bot) return;
  
  // Verificar se a mensagem está em um canal de ticket
  if (!message.channel.name.startsWith('ticket-')) return;
  
  try {
    console.log(`Message received in Discord channel ${message.channel.name}`);
    
    // Extrair o ID do ticket do tópico do canal
    const channelTopic = message.channel.topic;
    if (!channelTopic) {
      console.log('Canal sem tópico, ignorando mensagem');
      return;
    }

    console.log(`Tópico do canal: ${channelTopic}`);
    const ticketIdMatch = channelTopic.match(/Ticket #([a-zA-Z0-9_]+)/);
    if (!ticketIdMatch) {
      console.log('ID do ticket não encontrado no tópico do canal');
      return;
    }

    const ticketId = ticketIdMatch[1];
    console.log(`ID do ticket extraído: ${ticketId}`);

    // Buscar o ticket
    const ticket = getTicketById(ticketId);
    
    // Verificar se o ticket existe
    if (!ticket) {
      // Verificar se o canal está na categoria de arquivados
      const isArchived = message.channel.name.startsWith('closed-') || 
                         (message.channel.parent && message.channel.parent.id === DISCORD_ARCHIVE_CATEGORY_ID);
      
      if (isArchived) {
        await message.reply('This ticket is closed. The user will not receive this message.');
      } else {
        await message.reply('This ticket does not exist in the system.');
      }
      return;
    }
    
    // Verificar se o ticket está fechado
    if (ticket.status === 'closed') {
      await message.reply('This ticket is closed. The user will not receive this message.');
      return;
    }
    
    // Adicionar a mensagem ao ticket
    ticket.messages.push({
      sender: 'support',
      content: message.content,
      timestamp: new Date().toISOString(),
      discordUserId: message.author.id,
      discordUsername: message.author.username
    });
    saveActiveTickets();
    
    // Enviar a mensagem para o usuário no Telegram
    const success = await sendToTelegramAPI(ticket.userId, message.content, ticketId, { isClosingMessage: false });
    
    // Reagir à mensagem para indicar sucesso ou falha
    if (success) {
      await message.react('✅');
    } else {
      await message.react('❌');
      await message.reply('Failed to send message to Telegram user. They may have blocked the bot.');
    }
  } catch (error) {
    console.error('Error handling Discord message:', error);
    try {
      await message.reply('An error occurred while processing your message.');
    } catch (replyError) {
      console.error('Error sending error reply:', replyError);
    }
  }
});

// Modificar o manipulador de interações do Discord para usar a mesma abordagem que usamos no Telegram
discordClient.on('interactionCreate', async (interaction) => {
  try {
    // Manipular apenas cliques no botão de fechar
    if (interaction.isButton() && interaction.customId.startsWith('close_')) {
      // Extrair o ID completo do ticket (tudo após "close_")
      const ticketId = interaction.customId.substring(6); // "close_".length = 6
      console.log(`[DEBUG-DISCORD] Botão de fechar clicado para o ticket: ${ticketId}`);
      
      // Verificar se o ticket existe usando o tópico do canal
      const channelTopic = interaction.channel.topic;
      console.log(`[DEBUG-DISCORD] Tópico do canal: ${channelTopic}`);
      
      // Extrair o ID do ticket do tópico do canal
      let ticket = null;
      if (channelTopic) {
        const match = channelTopic.match(/Ticket #([^|]+)/);
        if (match && match[1]) {
          const ticketIdFromTopic = match[1].trim();
          console.log(`[DEBUG-DISCORD] ID do ticket extraído do tópico: ${ticketIdFromTopic}`);
          
          // Buscar o ticket pelo ID extraído do tópico
          ticket = activeTickets.find(t => t.id === ticketIdFromTopic);
        }
      }
      
      // Se não encontrou pelo tópico, tentar pelo ID do botão
      if (!ticket) {
        ticket = activeTickets.find(t => t.id === ticketId);
      }
      
      console.log(`[DEBUG-DISCORD] Resultado da busca: ${ticket ? JSON.stringify(ticket) : 'Não encontrado'}`);
      
      if (!ticket) {
        console.log(`[DEBUG-DISCORD] Ticket não encontrado ou já fechado`);
        return interaction.reply({ content: 'Ticket not found or already closed.', ephemeral: true });
      }
      
      console.log(`[DEBUG-DISCORD] Fechando ticket: ${ticket.id}, Status atual: ${ticket.status}`);
      
      // Fechar o ticket (remover da lista de ativos)
      const index = activeTickets.findIndex(t => t.id === ticket.id);
      
      if (index === -1) {
        console.log(`[DEBUG-DISCORD] Ticket não encontrado na lista de ativos: ${ticket.id}`);
        return interaction.reply({ content: 'Ticket not found or already closed.', ephemeral: true });
      }
      
      // Remover o ticket da lista de ativos
      activeTickets.splice(index, 1);
      saveActiveTickets();
      console.log(`[DEBUG-DISCORD] Ticket removido da lista de ativos: ${ticket.id}`);
      
      // Notificar o usuário no Telegram
      try {
        const lang = getUserLanguage(ticket.userId);
        console.log(`[DEBUG-DISCORD] Notificando usuário ${ticket.userId} sobre o fechamento do ticket ${ticket.id}`);
        await sendToTelegramAPI(
          ticket.userId,
          getTranslation('ticketClosedBySupport', lang, ticket.id, ticket.subject),
          ticket.id,
          { isClosingMessage: true }
        );
      } catch (error) {
        console.error('Error notifying user about ticket closure:', error);
      }
      
      // Responder à interação
      const embed = new EmbedBuilder()
        .setTitle(`Ticket #${ticket.id} Closed`)
        .setDescription(`The ticket "${ticket.subject}" was closed by the user.`)
        .setColor(0xFF0000)
        .setFooter({ text: `Ticket ID: ${ticket.id}` })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      
      // Arquivar o canal
      try {
        const channel = interaction.channel;
        
        // Renomear o canal
        await channel.setName(`closed-${ticket.id.replace(/_/g, '')}`);
        
        // Mover para a categoria de arquivamento
        if (DISCORD_ARCHIVE_CATEGORY_ID) {
          try {
            console.log(`[DEBUG-TELEGRAM] Buscando categoria de arquivamento: ${DISCORD_ARCHIVE_CATEGORY_ID}`);
            const archiveCategory = await discordGuild.channels.fetch(DISCORD_ARCHIVE_CATEGORY_ID);
            if (archiveCategory) {
              console.log(`[DEBUG-TELEGRAM] Movendo canal para categoria de arquivamento: ${archiveCategory.name}`);
              await channel.setParent(archiveCategory.id);
              console.log(`[DEBUG-TELEGRAM] Canal movido para categoria de arquivamento`);
            } else {
              console.warn(`Categoria de arquivamento ${DISCORD_ARCHIVE_CATEGORY_ID} não encontrada`);
            }
          } catch (error) {
            console.error(`Erro ao buscar categoria de arquivamento:`, error);
          }
        }
        
        // Desabilitar envio de mensagens no canal
        try {
          const everyoneRole = discordGuild.roles.everyone;
          if (everyoneRole) {
            await channel.permissionOverwrites.edit(everyoneRole.id, {
              SendMessages: false
            });
          }
          
          if (DISCORD_MOD_ROLE_ID) {
            try {
              const modRole = await discordGuild.roles.fetch(DISCORD_MOD_ROLE_ID);
              if (modRole) {
                await channel.permissionOverwrites.edit(modRole.id, {
                  SendMessages: false
                });
              }
            } catch (error) {
              console.error(`Erro ao buscar cargo de moderador:`, error);
            }
          }
        } catch (permError) {
          console.error('Erro ao desabilitar envio de mensagens no canal:', permError);
        }
      } catch (error) {
        console.error('Error archiving channel:', error);
      }
    }
  } catch (error) {
    console.error('Error handling Discord interaction:', error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
      }
    } catch (replyError) {
      console.error('Error sending error reply:', replyError);
    }
  }
});

// Adicionar comandos em diferentes idiomas
const commandAliases = {
  start: ['start'],
  help: ['help', 'ajuda', 'ayuda'],
  newticket: ['newticket', 'novoticket', 'nuevoticket'],
  mytickets: ['mytickets', 'meustickets', 'mistickets'],
  closeticket: ['closeticket', 'fecharticket', 'cerrarticket'],
  language: ['language', 'idioma']
};

// Corrigir o manipulador de erros do Telegram
telegramBot.catch((err, ctx) => {
  console.error('Unhandled error while processing', ctx.update);
  console.error('Erro ao iniciar o bot do Telegram:', err);
});

// Manipular encerramento gracioso
process.once('SIGINT', () => {
  telegramBot.stop('SIGINT');
  discordClient.destroy();
});

process.once('SIGTERM', () => {
  telegramBot.stop('SIGTERM');
  discordClient.destroy();
});

// Adicionar manipulador para o botão de fechar ticket diretamente
telegramBot.action(/direct_close_(.+)/, async (ctx) => {
  console.log('Direct close action received');
  const ticketId = ctx.match[1];
  console.log(`[DEBUG-TELEGRAM] ID do ticket extraído do botão direct_close_: ${ticketId}`);
  
  const userId = ctx.from.id;
  const lang = getUserLanguage(userId);
  
  // Encontrar o ticket do usuário atual
  console.log(`[DEBUG-TELEGRAM] Buscando tickets do usuário: ${userId}`);
  const userTickets = activeTickets.filter(t => t.userId === userId.toString() && t.status === 'open');
  console.log(`[DEBUG-TELEGRAM] Tickets encontrados para o usuário: ${userTickets.length}`);
  
  if (userTickets.length === 0) {
    console.log(`[DEBUG-TELEGRAM] Nenhum ticket ativo encontrado para o usuário: ${userId}`);
    return ctx.answerCbQuery(getTranslation('ticketNotFound', lang));
  }
  
  // Usar o primeiro ticket ativo do usuário
  const ticket = userTickets[0];
  console.log(`[DEBUG-TELEGRAM] Usando o ticket: ${JSON.stringify(ticket)}`);
  
  // Confirmar antes de fechar
  try {
    await ctx.answerCbQuery();
    
    // Perguntar se o usuário tem certeza
    console.log(`[DEBUG-TELEGRAM] Enviando mensagem de confirmação para fechar o ticket ${ticket.id}`);
    await ctx.reply(
      getTranslation('confirmCloseTicket', lang),
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ ' + getTranslation('closeTicketButton', lang), `confirm_close_${ticket.id}`),
          Markup.button.callback('❌ ' + 'Cancel', `cancel_close_${ticket.id}`)
        ]
      ])
    );
  } catch (error) {
    console.error('Error showing close confirmation:', error);
    await ctx.answerCbQuery('Error showing confirmation dialog');
  }
});

// Manipulador para confirmar fechamento de ticket
telegramBot.action(/confirm_close_(.+)/, async (ctx) => {
  console.log('Confirm close action received');
  const ticketId = ctx.match[1];
  console.log(`[DEBUG-TELEGRAM] ID do ticket extraído do botão confirm_close_: ${ticketId}`);
  
  const userId = ctx.from.id;
  const lang = getUserLanguage(userId);
  
  // Encontrar o ticket do usuário atual
  console.log(`[DEBUG-TELEGRAM] Buscando tickets do usuário: ${userId}`);
  const userTickets = activeTickets.filter(t => t.userId === userId.toString() && t.status === 'open');
  console.log(`[DEBUG-TELEGRAM] Tickets encontrados para o usuário: ${userTickets.length}`);
  
  if (userTickets.length === 0) {
    console.log(`[DEBUG-TELEGRAM] Nenhum ticket ativo encontrado para o usuário: ${userId}`);
    return ctx.answerCbQuery(getTranslation('ticketNotFound', lang));
  }
  
  // Usar o primeiro ticket ativo do usuário
  const ticket = userTickets[0];
  console.log(`[DEBUG-TELEGRAM] Usando o ticket: ${JSON.stringify(ticket)}`);
  
  // Fechar o ticket
  console.log(`[DEBUG-TELEGRAM] Fechando o ticket: ${ticket.id}`);
  const index = activeTickets.findIndex(t => t.id === ticket.id);
  
  if (index === -1) {
    console.log(`[DEBUG-TELEGRAM] Ticket não encontrado na lista de ativos: ${ticket.id}`);
    return ctx.answerCbQuery(getTranslation('ticketNotFound', lang));
  }
  
  // Remover o ticket da lista de ativos
  activeTickets.splice(index, 1);
  saveActiveTickets();
  console.log(`[DEBUG-TELEGRAM] Ticket removido da lista de ativos: ${ticket.id}`);
  
  // Limpar sessão do usuário
  if (userSessions[userId]) {
    delete userSessions[userId];
    console.log(`[DEBUG-TELEGRAM] Sessão do usuário removida: ${userId}`);
  }
  
  try {
    await ctx.answerCbQuery('Ticket closed successfully');
    
    // Enviar mensagem de confirmação
    await ctx.editMessageText(
      getTranslation('ticketClosed', lang, ticket.id, ticket.subject)
    );
    
    // Notificar o Discord que o ticket foi fechado
    if (ticket.discordChannelId) {
      try {
        const channel = await discordClient.channels.fetch(ticket.discordChannelId);
        
        // Enviar mensagem de fechamento
        const embed = new EmbedBuilder()
          .setTitle(`Ticket #${ticket.id} Closed`)
          .setDescription(`The ticket "${ticket.subject}" was closed by the user.`)
          .setColor(0xFF0000)
          .setFooter({ text: `Ticket ID: ${ticket.id}` })
          .setTimestamp();
        
        await channel.send({ 
          content: `**Ticket #${ticket.id} Closed by User**`,
          embeds: [embed]
        });
        
        // Arquivar o canal
        await channel.setName(`closed-${ticket.id.replace(/_/g, '')}`);
        
        // Mover para a categoria de arquivamento
        if (DISCORD_ARCHIVE_CATEGORY_ID) {
          try {
            console.log(`[DEBUG-TELEGRAM] Buscando categoria de arquivamento: ${DISCORD_ARCHIVE_CATEGORY_ID}`);
            const archiveCategory = await discordGuild.channels.fetch(DISCORD_ARCHIVE_CATEGORY_ID);
            if (archiveCategory) {
              console.log(`[DEBUG-TELEGRAM] Movendo canal para categoria de arquivamento: ${archiveCategory.name}`);
              await channel.setParent(archiveCategory.id);
              console.log(`[DEBUG-TELEGRAM] Canal movido para categoria de arquivamento`);
            } else {
              console.warn(`Categoria de arquivamento ${DISCORD_ARCHIVE_CATEGORY_ID} não encontrada`);
            }
          } catch (error) {
            console.error(`Erro ao buscar categoria de arquivamento:`, error);
          }
        }
        
        // Desabilitar envio de mensagens no canal
        const everyoneRole = discordGuild.roles.everyone;
        if (everyoneRole) {
          await channel.permissionOverwrites.edit(everyoneRole.id, {
            SendMessages: false
          });
        }
        
        if (DISCORD_MOD_ROLE_ID) {
          try {
            const modRole = await discordGuild.roles.fetch(DISCORD_MOD_ROLE_ID);
            if (modRole) {
              await channel.permissionOverwrites.edit(modRole.id, {
                SendMessages: false
              });
            }
          } catch (error) {
            console.error(`Erro ao buscar cargo de moderador:`, error);
          }
        }
      } catch (error) {
        console.error(`Error handling Discord channel for ticket ${ticket.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error closing ticket:', error);
    await ctx.answerCbQuery('Error closing ticket');
  }
});

// Manipulador para cancelar fechamento de ticket
telegramBot.action(/cancel_close_(.+)/, async (ctx) => {
  console.log('Cancel close action received');
  const ticketId = ctx.match[1];
  console.log(`[DEBUG-TELEGRAM] ID do ticket extraído do botão cancel_close_: ${ticketId}`);
  
  try {
    await ctx.answerCbQuery('Ticket closure cancelled');
    await ctx.deleteMessage();
  } catch (error) {
    console.error('Error cancelling ticket closure:', error);
    await ctx.answerCbQuery('Error cancelling');
  }
});