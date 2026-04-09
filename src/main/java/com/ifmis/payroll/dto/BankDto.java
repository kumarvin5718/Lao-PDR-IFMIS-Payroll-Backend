package com.ifmis.payroll.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class BankDto {
    private UUID id;
    private String bankName;
}
