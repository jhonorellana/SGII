import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-actions.component.html',
  styleUrls: ['./modal-actions.component.css']
})
export class ModalActionsComponent {
  @Input() cancelText: string = 'Cancelar';
  @Input() saveText: string = 'Guardar';
  @Input() loading: boolean = false;
  @Input() disabled: boolean = false;
  @Input() showCancelButton: boolean = true;
  @Input() showSaveButton: boolean = true;

  @Output() onCancel = new EventEmitter<void>();
  @Output() onSave = new EventEmitter<void>();

  onCancelClick(): void {
    this.onCancel.emit();
  }

  onSaveClick(): void {
    this.onSave.emit();
  }
}
