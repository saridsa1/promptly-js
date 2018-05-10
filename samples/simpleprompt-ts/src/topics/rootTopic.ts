import { TopicsRoot, ConversationTopicState, TextPrompt, IntPrompt } from 'promptly-bot';
import { BotConversationState, BotUserState } from '../app';
import { StateTurnContext } from '../bot/StateTurnContext';
import { Alarm } from '../alarms';
import { ActivityTypes } from 'botbuilder';

export interface RootTopicState extends ConversationTopicState { 
    name: string;
    age: number;
}

export class RootTopic 
    extends TopicsRoot<
        StateTurnContext<BotConversationState, BotUserState>, 
        BotConversationState, 
        RootTopicState> {

    public constructor(context: StateTurnContext<BotConversationState, BotUserState>) {
        super(context);

        this.subTopics
            .set("namePrompt", () => new TextPrompt<StateTurnContext<BotConversationState, BotUserState>>()
                .onPrompt(`What is your name?`)
                .onSuccess((context, value) => {
                    this.clearActiveTopic();

                    this.state.name = value;

                    return this.onReceiveActivity(context);
                })
            )
            .set("agePrompt", () => new IntPrompt<StateTurnContext<BotConversationState, BotUserState>>()
                .onPrompt(`How old are you?`)
                .onSuccess((context, value) => {
                    this.clearActiveTopic();

                    this.state.age = value;

                    return this.onReceiveActivity(context);
                })
            );

    }

    public onReceiveActivity(context: StateTurnContext<BotConversationState, BotUserState>) { 

        if (context.activity.type === 'message') {
            
            // Check to see if there is an active topic.
            if (this.hasActiveTopic) {
                // Let the active topic handle this turn by passing context to it's OnReceiveActivity().
                return this.activeTopic.onReceiveActivity(context);
            }

            // If you don't have the state you need, prompt for it
            if (!this.state.name) {
                return this.setActiveTopic("namePrompt")
                    .onReceiveActivity(context);
            }

            if (!this.state.age) {
                return this.setActiveTopic("agePrompt")
                    .onReceiveActivity(context);                
            }

            // Now that you have the state you need (age and name), use it!
            return context.sendActivity(`Hello ${ this.state.name }! You are ${ this.state.age } years old.`);
        }
    }

    public showDefaultMessage(context: StateTurnContext<BotConversationState, BotUserState>) {
        context.sendActivity("'Add Alarm'.");
    }
}