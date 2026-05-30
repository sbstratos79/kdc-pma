import { EventEmitter } from 'events';

export interface EntityChangeEvent {
	entity: 'architects' | 'projects' | 'tasks';
	action: 'create' | 'update' | 'delete';
}

class EntityChangeEmitter extends EventEmitter {
	constructor() {
		super();
		this.setMaxListeners(100);
	}
}

export const entityChangeEmitter = new EntityChangeEmitter();
