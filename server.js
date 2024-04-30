import { Telegraf } from "telegraf";
import OpenAI from 'openai'
import userModel from "./src/models/Users.js"
import eventModel from './src/models/Events.js'
import connectDb from "./src/config/db.js"
import {message} from "telegraf/filters"
// creating the bot with the token that we have created earlier 
const bot = new Telegraf(process.env.BOT_TOKEN)

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

try{
  connectDb();
  console.log("DB Connected!!")
}catch(err) {
  console.log(err);
  process.kill(process.pid, 'SIGTERM')
}

// To start the BOT
bot.start(async(ctx) =>{
  console.log('ctx',ctx)
  //Store Inforamtion in the Db 
  const from = ctx.update.message.from;
  console.log('from', from);
  try {
    await userModel.findOneAndUpdate({tgId: from.id},{
      $setOnInsert: {
        firstName: from.first_name,
        lastName: from.last_name,
        isBot: from.is_bot,
        username: from.username,
      }
    }, { upsert: true, new: true}
  );
  await ctx.reply(`Hey ${from.first_name}, Welcome I will be writing social enfgagement events throughout the day; Lets prep you up !`);

  } catch(err){
    console.log(err);
    await ctx.reply("Facing difficulties!!!");
  }  
})

// on command `generate`
bot.command('generate', async(ctx)=>{
  const from= ctx.update.message.from

  // Set Dates

  const startofDay = new Date();
  startofDay.setHours(0,0,0,0);

  const endofDay = new Date();
  endofDay.setHours(23,59,59,999);

  const events = await eventModel.find({
    tgId: from.id,
    createdAt:{
      $gte: startofDay,
      $lte: endofDay
    }
  })

  if (events.length === 0) {
    await ctx.reply("No Events for the Day");
  }

  console.log('events', events)
  
  // MAKE OPENAI API CALL

  try {
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Act as a Senior Copywriter, to write a higly engaging posts for linkedin, facebook, twitter using thoughts /events throught the day',
        },
        {
          role: 'user',
          content: `Write like a human, Craft three highly engaging social media posts tailored for Linkedin, Facebook and Twitter audience. Use Simple Language; use given time lables hust to understand the order of the tweet, dont mention the time in the posts. Each post should creatively highlight the following event. Ensure the tone is conversational and impactful. Focus on engaging the respective platforms audience encouraging the interaction and driving the interest in the events:
          ${events.map((event)=> event.text).join(', ')}`,
        }
      ],
      model: process.env.OPENAI_MODEL
    })
    console.log('Completion', chatCompletion)
    await ctx.reply('Doing something...');
  }catch(err){
    console.log("Facing Difficulties in OPEN AI");
  }
})

// Perform operation on the saved message
bot.on(message('text'), async(ctx) => {
  const from = ctx.update.message.from;
  const message = ctx.update.message.text;
  try {
    await eventModel.create({
      text: message,
      tgId: from.id,
    })
    await ctx.reply('NOTED !!! Just text me your thoughts togenerate the POSTS; for that enter the /generate command')
  }catch(err){
    console.log(err);
    await ctx.reply("Facing difficulties ; please try again later");
  }
})

bot.launch()

process.once('SIGINT', ()=> bot.stop('SIGINT'));
process.once('SIGTERM', ()=> bot.stop('SIGTERM'));
