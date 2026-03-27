package com.ifmis.payroll.entity;


import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "employee_payroll_flags")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeePayrollFlags {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private Boolean hasSpouse;

    private Integer noOfEligibleChildren;
}
