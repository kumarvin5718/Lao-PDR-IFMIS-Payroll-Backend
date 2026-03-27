package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "bank_branch")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BankBranch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_name", nullable = false)
    private String branchName;

    @Column(name = "branch_code", unique = true)
    private String branchCode;

    @Column(name = "city")
    private String city;

    @Column(name = "swift_bic_code")
    private String swiftBICCode;

    @Column(name = "branch_address")
    private String branchAddress;

    @Column(name = "bank_hq_address")
    private String bankHQAddress;

    @ManyToOne(fetch = FetchType.LAZY )
    @JoinColumn(name = "bank_id", nullable = false)
    private LKBankMaster bank;
}