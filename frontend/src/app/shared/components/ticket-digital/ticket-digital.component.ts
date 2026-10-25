import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketData, BoletoDigitalData, GuiaDigitalData, TicketService } from '../../../core/services/ticket.service';

@Component({
  selector: 'app-ticket-digital',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticket-digital.component.html',
  styleUrl: './ticket-digital.component.css',
})
export class TicketDigitalComponent {
  public ticketService = inject(TicketService);

  @Input() public ticket: TicketData | null = null;
  @Output() public cerrar = new EventEmitter<void>();

  public get esPasaje(): boolean {
    return this.ticket?.tipo === 'pasaje';
  }

  public get boleto(): BoletoDigitalData | null {
    return this.ticket?.tipo === 'pasaje' ? (this.ticket as BoletoDigitalData) : null;
  }

  public get guia(): GuiaDigitalData | null {
    return this.ticket?.tipo === 'encomienda' ? (this.ticket as GuiaDigitalData) : null;
  }

  public imprimir(): void {
    this.ticketService.imprimir();
  }

  public onCerrar(): void {
    this.cerrar.emit();
  }
}
