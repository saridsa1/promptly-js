import { Alarm, showAlarms } from '../alarms';
import { Topic } from '../promptly/topic';
import { ParentTopic, ParentTopicState } from '../promptly/parentTopic';
import { Prompt } from '../promptly/prompt';
import { Validator } from '../validator/validator';

export interface DeleteAlarmTopicState extends ParentTopicState {
    alarms?: Alarm[];
    alarmIndex?: number;
    alarm?: Partial<Alarm>;
    deleteConfirmed?: boolean;
}

export class DeleteAlarmTopic extends ParentTopic<DeleteAlarmTopicState> {

    protected subTopics = {
        whichAlarmPrompt: new Prompt<number>('whichAlarmPrompt')
            .onPrompt((c, ltvr) => {                           
                let msg = `Which alarm would you like to delete?`

                if(ltvr && ltvr === 'indexnotfound') {
                    c.reply(`Sorry, I coulnd't find an alarm named '${c.request.text}'.`)
                        .reply(`Let's try again.`);
                }
                
                // Basically the prompt is a choice prompt, so show the alarms.
                showAlarms(c);

                return c.reply(msg);
            })
            // START HERE: AlarmIndexValidator is instantiated when DeleteAlarmTopic is constructed,
            //  so this.state.alarms is empty, so this prompt never works.
            .validator(new AlarmIndexValidator(this.state.alarms))
            .maxTurns(2)
            .onSuccess((c, v) => {
                this.state.alarmIndex = v;
                
                // TODO: Move this to base class to clean up and (maybe) loop again.
                this.state.activeTopic = undefined;

                return this.onReceive(c);
            })
            .onFailure((c, fr) => {
                if(fr && fr === 'toomanyattempts') {
                    c.reply(`I'm sorry I'm having issues understanding you. Let's try something else. Say 'Help'.`);
                }

                // TODO: Move this to base class to clean up and (maybe) loop again.
                this.state.activeTopic = undefined;

                // TODO: Remove active topic. Move this to onSuccess/onFailure of calling Topic.
                c.state.conversation.rootTopic.state.activeTopic = undefined;

                return;
            }),

        confirmDeletePrompt: new Prompt<boolean>('confirmDeletePrompt')
            .onPrompt((c, ltvr) => {
                let msg = `Are you sure you want to delete alarm '${ this.state.alarm.title }' ('yes' or 'no')?`;

                if(ltvr && ltvr === 'notyesorno') {
                    c.reply(`Sorry, I was expecting 'yes' or 'no'.`)
                        .reply(`Let's try again.`);
                }

                return c.reply(msg);
            })
            .validator(new YesOrNoValidator())
            .maxTurns(2)
            .onSuccess((c, v) => {
                this.state.deleteConfirmed = v;
                
                // TODO: Move this to base class to clean up and (maybe) loop again.
                this.state.activeTopic = undefined;

                return this.onReceive(c);
            })
            .onFailure((c, fr) => {
                if(fr && fr === 'toomanyattempts') {
                    c.reply(`I'm sorry I'm having issues understanding you. Let's try something else. Say 'Help'.`);
                }

                // TODO: Move this to base class to clean up and (maybe) loop again.
                this.state.activeTopic = undefined;

                // TODO: Remove active topic. Move this to onSuccess/onFailure of calling Topic.
                c.state.conversation.rootTopic.state.activeTopic = undefined;

                return;
            })
    }

    // TODO: Turn state into class that initializes itself if not passed.
    public constructor(name: string, state: DeleteAlarmTopicState = { alarms: [] as Alarm[], alarm: {} as Alarm, activeTopic: undefined }) {
        super(name, state);
    }

    // State is used to manage the internal state of the Topic between turns, but there might be some state used to initialize the pre-created fluent
    //  prompt to be used in this instance.
    public initialize(alarms: Alarm[] = []) {
        this.state.alarms = alarms;

        // TODO: I have to do this since the reference to alarms passed in the initialization 
        //  of validator is by value, not by reference.
        // NOTE: This DOES NOT work, since on the next turn the AlarmIndexValidator is created
        //  with empty array during the construction/instantiation of this class.
        this.subTopics.whichAlarmPrompt.validator(new AlarmIndexValidator(this.state.alarms));

        return this;
    }

    public onReceive(context: BotContext) {

        if(this.hasActiveTopic) { 
            return this.activeTopic.onReceive(context);
        }

        // TODO: Refactor this to be a validation reason.
        // If there are no alarms to delete...
        if (this.state.alarms.length === 0) {
            return context.reply(`There are no alarms to delete.`);
        }

        if (this.state.alarmIndex === undefined) {
            // If there is only one alarm to delete, use that index. No need to prompt.
            if (this.state.alarms.length === 1) {
                showAlarms(context);

                this.state.alarmIndex = 0;
            } else {
                this.activeTopic = this.subTopics.whichAlarmPrompt;
                    
                return this.activeTopic.onReceive(context);
            }
        }

        // TODO: Refactor this out to make it on success of the which title prompt.
        this.state.alarm.title = this.state.alarms[this.state.alarmIndex].title;
    
        if (this.state.deleteConfirmed === undefined) {
            
            this.activeTopic = this.subTopics.confirmDeletePrompt;

            return this.activeTopic.onReceive(context);
        }

        return this._onSuccess(context, this.state);
    }
}

class AlarmIndexValidator extends Validator<number> {

    private _alarms: Alarm[] = [];

    constructor(alarms: Alarm[]) {
        super();
        this._alarms = alarms;
    }

    public validate(context: BotContext) {
        const index = this._alarms.findIndex((alarm) => {
            return alarm.title.toLowerCase() === context.request.text.toLowerCase();
        });

        if(index > -1) {
            return { value: index };
        } else {
            return { reason: 'indexnotfound' };
        }
    }
}

// TODO: Refactor into a confirm prompt with yes, y, yup, etc. validator.
class YesOrNoValidator extends Validator<boolean> {
    public validate(context: BotContext) {
        if(context.request.text === 'yes') {
            return { value: true };
        } else if(context.request.text === 'no') {
            return { value: false };
        } else {
            return { reason: 'notyesorno' };
        }
    }
}