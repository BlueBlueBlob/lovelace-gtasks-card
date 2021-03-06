customElements.whenDefined('card-tools').then(() => {
  let cardTools = customElements.get('card-tools');
    
  class GtasksCard extends cardTools.LitElement {
    
    setConfig(config) {
      if (!config.entity) {
        throw new Error('Please define entity');
      }
      this.config = config;
    }
    
    calculateDueDate(dueDate){
      var oneDay = 24*60*60*1000; // hours*minutes*seconds*milliseconds
      var today = new Date();
      today.setHours(0,0,0,0)

      var splitDate = dueDate.split(/[- :T]/)
      var parsedDueDate = new Date(splitDate[0], splitDate[1]-1, splitDate[2]);
      parsedDueDate.setHours(0,0,0,0)
      
      var dueInDays;
      if(today > parsedDueDate) {
        dueInDays = -1;
      }
      else
        dueInDays = Math.round(Math.abs((today.getTime() - parsedDueDate.getTime())/(oneDay)));

      return dueInDays;
    }

    checkDueClass(dueInDays) {
      if (dueInDays == 0)
        return "due-today";
      else if (dueInDays < 0)
        return "overdue";
      else
        return "not-due";
    }

    formatDueDate(dueDate, dueInDays) {
      if (dueInDays < 0)
        return this.config.custom_translation != null && this.config.custom_translation.overdue != null ? this.config.custom_translation.overdue : "Overdue";
      else if (dueInDays == 0)
        return this.config.custom_translation != null && this.config.custom_translation.today != null ? this.config.custom_translation.today : "Today";
      else
        return dueDate.substr(0, 10);
    }

    render(){
      return cardTools.LitHtml
      `
        ${this._renderStyle()}
        ${cardTools.LitHtml
          `<ha-card>
            <div class="header">
              <div class="name">
                ${this.header}
              </div>
            </div>
            <div>
              ${this.tasks.length > 0 ? cardTools.LitHtml`
              ${this.tasks.map(task =>
                cardTools.LitHtml`
                <div class="info flex">
                  <div>
                    ${task.task_title}
                    <div class="secondary">
                    ${this.config.custom_translation != null && this.config.custom_translation.due != null ? this.config.custom_translation.due : "Due"}: <span class="${task.due_date != null ? this.checkDueClass(task.dueInDays) : ""}">${task.due_date != null ? this.formatDueDate(task.due_date, task.dueInDays) : "-"}</span>
                    </div>
                  </div>
                  <div>
                    <mwc-button @click=${ev => this._track(task.task_title)}>${this.config.custom_translation != null && this.config.custom_translation.track != null ? this.config.custom_translation.track : "Track"}</mwc-button>
                  </div>
                </div>

                `
              )}` : cardTools.LitHtml`<div class="info flex">${this.config.custom_translation != null && this.config.custom_translation.empty != null ? this.config.custom_translation.empty : "No tasks!"}</div>`}
            </div>
            ${this.notShowing.length > 0 ? cardTools.LitHtml`<div class="secondary">${this.config.custom_translation != null && this.config.custom_translation.more != null ? this.config.custom_translation.more.replace("{number}", this.notShowing.length) : "Look in Grocy for " + this.notShowing.length + " more tasks..."}</div>`
            : ""}
          </ha-card>`}
      `;
    }    
    _track(task_name){
      this._hass.callService("gtasks", "complete_task", {
        task_title: task_name,
        tasks_list: this.list_name
      });
    }

    _renderStyle() {
        return cardTools.LitHtml
        `
          <style>
            ha-card {
              padding: 16px;
            }
            .header {
              padding: 0;
              @apply --paper-font-headline;
              line-height: 40px;
              color: var(--primary-text-color);
              padding: 4px 0 12px;
            }
            .info {
              padding-bottom: 1em;
            }
            .flex {
              display: flex;
              justify-content: space-between;
            }
            .overdue {
              color: red !important;
            }
            .due-today {
              color: orange !important;
            }
            .secondary {
              display: block;
              color: #8c96a5;
          }
          </style>
        `;
      }
    
    set hass(hass) {
      this._hass = hass;
      
      const entity = hass.states[this.config.entity];
      const list_title = entity.attributes.friendly_name.split('_')[1]
      this.list_name = list_title
      this.header = this.config.title == null ? list_title : this.config.title;

      this.show_quantity = this.config.show_quantity == null ? null : this.config.show_quantity;
      this.show_days = this.config.show_days == null ? null : this.config.show_days;

      if (entity.state == 'unknown')
        throw new Error("The Gtasks sensor is unknown.");
        
      var tasks = entity.attributes.tasks;
      var allTasks = []

      if(tasks != null){
        tasks.sort(function(a,b){
          if (a.due_date != null && b.due_date != null) {
            var aSplitDate = a.due_date.split(/[- :T]/)
            var bSplitDate = b.due_date.split(/[- :T]/)
  
            var aParsedDueDate = new Date(aSplitDate[0], aSplitDate[1]-1, aSplitDate[2]);
            var bParsedDueDate = new Date(bSplitDate[0], bSplitDate[1]-1, bSplitDate[2]);
  
            return aParsedDueDate - bParsedDueDate;
          }
            return;
        })

        tasks.map(task =>{
          var dueInDays = task.due_date ? this.calculateDueDate(task.due_date) : 10000;
          task.dueInDays = dueInDays;
          if(this.show_days != null) {
            if(dueInDays <= this.show_days){
              allTasks.push(task);
            }
            else if(task.due_date != null && task.due_date.slice(0,4) == "2999") {
              task.due_date = "-";
              allTasks.unshift(task)
            }
          }
          else {
            if(task.due_date == null || dueInDays == 10000 || task.due_date.slice(0,4) == "2999"){
              task.due_date = "-";
              allTasks.unshift(task)
            }
            else
              allTasks.push(task);
          }
        })
        
        if(this.show_quantity != null){
          this.tasks = allTasks.slice(0, this.show_quantity);
          this.notShowing = allTasks.slice(this.show_quantity);
        }
        else{
          this.tasks = allTasks;
          this.notShowing = 0;
        }
      }
      else
        this.tasks = allTasks;
      
      this.state = entity.state
      this.requestUpdate();
    }
    

  
      // @TODO: This requires more intelligent logic
    getCardSize() {
      return 3;
    }
  }
  
  customElements.define('gtasks-card', GtasksCard);
  });
  
  window.setTimeout(() => {
    if(customElements.get('card-tools')) return;
    customElements.define('gtasks-card', class extends HTMLElement{
      setConfig() { throw new Error("Can't find card-tools. See https://github.com/thomasloven/lovelace-card-tools");}
    });
  }, 2000);
