package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "bank_category")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BankCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @OneToMany(mappedBy = "bankCategory", cascade = CascadeType.ALL)
    private List<LKBankMaster> banks;
}