import { Component, OnInit, Input, Inject, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormControl, FormBuilder } from '@angular/forms';
import { DataPathUtils } from '../../../utils/dataPath.utils';
import { MultipartFormUtils } from '../../../utils/multipartForm.utils';
import { ToastrService } from 'ngx-toastr';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { RequestHeaders } from '../../../services/config.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'put-dialog',
  templateUrl: './put.component.html',
  styleUrls: ['./put.component.scss'],
  animations: [
    trigger('dialog', [
      transition('void => *', [
        style({ transform: 'scale3d(.3, .3, .3)' }),
        animate(100)
      ]),
      transition('* => void', [
        animate(100, style({ transform: 'scale3d(.0, .0, .0)' }))
      ])
    ])
  ]
})
export class PutComponent implements OnInit {
  @Input() closable = true;

  @Input() visible: boolean;

  @Output() visibleChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  @Output() stateChanged = new EventEmitter();

  @Input('pageData') pageData: any;

  @Input('rowData') rowData: any;

  loading: boolean = false;

  myForm: FormGroup = this._fb.group(this.buildFormFields());

  fields: Array<any> = [];

  methodData: any = {};

  workingRowData: any;

  total_looping: number;

  constructor(@Inject('RequestsService') private requestsService,
    @Inject('DataPathUtils') private dataPathUtils,
    @Inject('MultipartFormUtils') private multipartFormUtils,
    @Inject('UrlUtils') private urlUtils,
    private toastrService: ToastrService,
    private _fb: FormBuilder) { }

  ngOnInit() {
    this.initForm();
  }

  ngOnChanges() {
    this.initForm();
  }

  public handleIconClick(url: string) {
    window.open(url, '_blank');
  }

  private initForm() {
    try {
      this.methodData = this.pageData.methods.put;
      this.fields = this.pageData.methods.put.fields;
    } catch (e) {
      this.fields = [];
    }
    this.myForm = this._fb.group(this.buildFormFields());

    this.myForm.valueChanges.subscribe(() => this.updateWorkingRowData());
    this.updateWorkingRowData();
  }

  private buildFormFields() {
    const obj = {};
    if (!this.fields || !this.fields.length) {
      return obj;
    }
    for (const field of this.fields) {
      let value = this.dataPathUtils.getFieldValueInPath(field.name, field.dataPath, this.rowData)
      if (field.type === 'object') {
        value = JSON.stringify(value);
      }
      if (field.type === 'array' || Array.isArray(value)) {
        // value = value.map((i) => field.arrayType === 'object' ? JSON.stringify(i) : i);
        if (!value) {
          value = [];
        }
        if (field.type !== 'array' && Array.isArray(value)) {
          value = JSON.stringify(value)
        } else {
          value = JSON.stringify(value, null, '\t');
        }
      }
      else if (field.dataType === 'json' && value) {
        value = JSON.stringify(value, null, '\t');
      }
      else if (field.dataType === 'value' && value) {
        value = JSON.stringify(value, null, '\t');
      } else if (field.dataPath === 'response' && value) {
        let jsonValue = value;
        try {
          jsonValue = JSON.parse(value);
          const isarray = Array.isArray(jsonValue);
          if (isarray) {
            const isAllSame = jsonValue.every((item: any) => JSON.stringify(item) === JSON.stringify(jsonValue[0]));
            if (isAllSame) {
              jsonValue = jsonValue[0];
            }
          }
          value = JSON.stringify(jsonValue, null, 4);
        } catch (e) {
          console.error('notif-->' + e)
          value = jsonValue;
        }
      } else if (field.name === 'metadata') {
        try {
          var total_looping = value['total_looping']
          if (total_looping == "null") {
            value = 0
          } else {
            value = value['total_looping'];
          }
        } catch (e) {
          value = 0
          console.error('errorParsingMetadata-->' + e)
        }
        let jsonValue = value;
        try {
          jsonValue = JSON.parse(value);
          const isarray = Array.isArray(jsonValue);
          if (isarray) {
            const isAllSame = jsonValue.every((item: any) => JSON.stringify(item) === JSON.stringify(jsonValue[0]));
            if (isAllSame) {
              jsonValue = jsonValue[0];
            }
          }
          value = JSON.stringify(jsonValue, null, 4);
        } catch (e) {
          console.error('notif-->' + e)
          value = jsonValue;
        }
      } else if (field.name === 'metadata') {
        try {
          value = value['total_looping'];
        } catch (e) {
          value = 0
          console.error('errorParsingMetadata-->' + e)
        }
      }
      const fieldName = field.dataPath ? `${field.dataPath}.${field.name}` : field.name;
      obj[fieldName] = new FormControl(value === undefined ? '' : value);
    }

    //Set URL and URLType values
    if (this.dataPathUtils.getFieldValueInPath('url', 'request', this.rowData)) {
      obj['url'] = new FormControl(this.dataPathUtils.getFieldValueInPath('url', 'request', this.rowData) || '');
      obj['urlPattern'] = new FormControl('url' || '');
    } else if (this.dataPathUtils.getFieldValueInPath('urlPath', 'request', this.rowData)) {
      obj['url'] = new FormControl(this.dataPathUtils.getFieldValueInPath('urlPath', 'request', this.rowData) || '');
      obj['urlPattern'] = new FormControl('urlPath' || '');
    } else if (this.dataPathUtils.getFieldValueInPath('urlPattern', 'request', this.rowData)) {
      obj['url'] = new FormControl(this.dataPathUtils.getFieldValueInPath('urlPattern', 'request', this.rowData) || '');
      obj['urlPattern'] = new FormControl('urlPattern' || '');
    } else if (this.dataPathUtils.getFieldValueInPath('urlPathPattern', 'request', this.rowData)) {
      obj['url'] = new FormControl(this.dataPathUtils.getFieldValueInPath('urlPathPattern', 'request', this.rowData) || '');
      obj['urlPattern'] = new FormControl('urlPathPattern' || '');
    }

    let delay = this.dataPathUtils.getFieldValueInPath('fixedDelayMilliseconds', 'response', this.rowData);

    //Set DelayType
    if (delay) {
      obj['response.delay'] = new FormControl(delay || '');
      obj['response.delayType'] = new FormControl('fixedDelayMilliseconds' || '');
    } else {
      obj['response.delayType'] = new FormControl('NONE' || '');
    }

    //Set Fault
    if (!this.dataPathUtils.getFieldValueInPath('fault', 'response', this.rowData)) {
      obj['response.fault'] = new FormControl('NONE' || '');
    }
    return obj;
  }

  private updateWorkingRowData() {
    const fields = this.buildFields();
    this.workingRowData = this.dataPathUtils.extractModelFromFields(fields);
  }

  public getFieldName(field) {
    if (!field.dataPath) {
      return field.name;
    }
    return `${field.dataPath}.${field.name}`;
  }

  public submit(e: Event) {
    e.preventDefault();
    this.request(this.workingRowData);
  }

  get requestHeaders(): RequestHeaders {
    return this.methodData.requestHeaders || this.pageData.requestHeaders || {};
  }

  private request(data = {}) {
    this.loading = true;

    if (environment.logApiData) {
      console.log('Making put request with data', data);
    }

    if (this.multipartFormUtils.isMultipartForm(this.fields)) {
      data = this.multipartFormUtils.extractMultipartFormData(this.fields, this.myForm);
    }

    let actualMethod = this.requestsService.put.bind(this.requestsService);
    const actualMethodType = this.methodData.actualMethod;
    if (actualMethodType && this.requestsService[actualMethodType]) {
      actualMethod = this.requestsService[actualMethodType].bind(this.requestsService);
    }

    let putUrl = this.methodData.url;
    const dataPath = this.methodData.dataPath;

    const extraUrlData = {};
    this.fields.map((field) => {
      if (field.useInUrl) {
        extraUrlData[field.name] = data[field.name];
      }
    });

    putUrl = this.urlUtils.getParsedUrl(putUrl, Object.assign(this.rowData, extraUrlData), dataPath);

    this.fields.map((field) => {
      if (field.type === 'object' || field.type === 'json') {
        data[field.name] = JSON.parse(data[field.name]);
      }
      else if (field.name === 'metadata') {
        try {
          this.total_looping = JSON.parse(data[field.name]);
          const jsonString = `{"total_looping": "${this.total_looping}"}`;
          data[field.name] = JSON.parse(jsonString);
        } catch (error) {
          console.log("errror")
        }
      } else if (field.label === 'Response') {
        if (this.total_looping != null && this.total_looping > 0) {
          let jsonValue = data['response']['body'];
          let valuesArray = [];
          const numberOfElements = this.total_looping;
          for (let i = 0; i < numberOfElements; i++) {
            try {
              let jsonObject = JSON.parse(jsonValue);
              valuesArray.push(jsonObject);
            } catch (error) {
              valuesArray.push(jsonValue);
            }
          }
          data['response']['body'] = JSON.stringify(valuesArray);
        }
      }
    });

    actualMethod(putUrl, data, this.requestHeaders).subscribe(data => {
      this.loading = false;
      this.toastrService.success('Successfully updated item', 'Success');
      this.close(true);
    }, error => {
      this.loading = false;
      this.toastrService.error(error, 'Error');
    });
  }

  private buildFields() {
    const fields = [];
    for (const param in this.myForm.controls) {
      const paramArr = param.split('.');
      const dataPath = paramArr.slice(0, -1).join('.');
      let value = this.myForm.controls[param].value;
      if (typeof value === 'string' && value.length === 0) {
        value = null;
      }
      fields.push({
        name: paramArr[paramArr.length - 1],
        value,
        dataPath
      });
    }
    return fields;
  }

  close(shouldRefresh = false) {
    this.visible = false;
    this.visibleChange.emit(this.visible);
    this.stateChanged.emit({ state: shouldRefresh ? 'afterChange' : null });
  }



}
