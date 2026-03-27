package com.ifmis.payroll.entity;

import com.ifmis.payroll.entity.master.BankBranch;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "employee_bank_detail")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeBankDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_code", nullable = false, unique = true)
    private EmployeePersonalInformation employee;

    // Many employees can use same branch
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private BankBranch branch;

    //  Account number
    @Column(name = "account_number", nullable = false, unique = true, length = 30)
    private String accountNumber;

}