package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "lk_bank_master")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LKBankMaster {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "bank_name", nullable = false)
    private String bankName;

    @Column(name = "abbrev")
    private String abbrev;

    @Column(name = "bank_key", unique = true)
    private String bankKey;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bank_category_id", nullable = false)
    private BankCategory bankCategory;

    @OneToMany(mappedBy = "bank", cascade = CascadeType.ALL)
    private List<BankBranch> branches;

    @Column(name = "telephone")
    private String telephone;

    @Column(name = "ownership")
    private String ownership;

    @Column(name = "established_year")
    private Integer establishedYear;

    @Column(name = "website", length = 200)
    private String website;
}